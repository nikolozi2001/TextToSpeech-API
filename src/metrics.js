const redis = require('./redis');
const { cache: cacheConfig } = require('./config');

const K = {
    total:       'metrics:total',
    hits:        'metrics:hits',
    misses:      'metrics:misses',
    hitTotalMs:  'metrics:hit:total_ms',
    hitCount:    'metrics:hit:count',
    missTotalMs: 'metrics:miss:total_ms',
    missCount:   'metrics:miss:count',
    recent:      'metrics:recent',
    timeline:    'metrics:timeline',
    top:         'metrics:top',
    errTotal:    'metrics:errors:total',
    errRecent:   'metrics:errors:recent',
};

async function recordRequest({ text, lang, cacheHit, durationMs }) {
    const entry = JSON.stringify({
        text: text.length > 60 ? text.substring(0, 60) + '...' : text,
        lang, cacheHit, durationMs, ts: Date.now(),
    });

    await redis.pipeline()
        .incr(K.total)
        .incr(cacheHit ? K.hits : K.misses)
        .incrbyfloat(cacheHit ? K.hitTotalMs : K.missTotalMs, durationMs)
        .incr(cacheHit ? K.hitCount : K.missCount)
        .lpush(K.recent, entry)
        .ltrim(K.recent, 0, 19)
        .zincrby(K.top, 1, text.substring(0, 100))
        .exec();
}

async function recordError({ type, message }) {
    const entry = JSON.stringify({ type, message, ts: Date.now() });
    await redis.pipeline()
        .incr(K.errTotal)
        .lpush(K.errRecent, entry)
        .ltrim(K.errRecent, 0, 9)
        .exec();
}

// Timeline snapshot every 60s
setInterval(async () => {
    try {
        const [total, hits, misses] = await redis.mget(K.total, K.hits, K.misses);
        const snap = JSON.stringify({
            ts:     Date.now(),
            total:  parseInt(total)  || 0,
            hits:   parseInt(hits)   || 0,
            misses: parseInt(misses) || 0,
        });
        await redis.pipeline()
            .lpush(K.timeline, snap)
            .ltrim(K.timeline, 0, 19)
            .exec();
    } catch (_) {}
}, 60_000);

async function getStats() {
    const [
        total, hits, misses,
        hitTotalMs, hitCount, missTotalMs, missCount,
        recent, timeline, errTotal, errRecent, topRaw,
    ] = await Promise.all([
        redis.get(K.total),   redis.get(K.hits),   redis.get(K.misses),
        redis.get(K.hitTotalMs), redis.get(K.hitCount),
        redis.get(K.missTotalMs), redis.get(K.missCount),
        redis.lrange(K.recent, 0, -1),
        redis.lrange(K.timeline, 0, -1),
        redis.get(K.errTotal),
        redis.lrange(K.errRecent, 0, -1),
        redis.zrevrange(K.top, 0, 9, 'WITHSCORES'),
    ]);

    const t  = parseInt(total)  || 0;
    const h  = parseInt(hits)   || 0;
    const hc = parseInt(hitCount)  || 0;
    const mc = parseInt(missCount) || 0;

    const topPhrases = [];
    for (let i = 0; i < topRaw.length; i += 2) {
        topPhrases.push({ text: topRaw[i], count: parseInt(topRaw[i + 1]) });
    }

    return {
        total:     t,
        hits:      h,
        misses:    parseInt(misses)  || 0,
        hitRate:   t > 0 ? Math.round((h / t) * 100) : 0,
        avgHitMs:  hc > 0 ? Math.round(parseFloat(hitTotalMs)  / hc) : 0,
        avgMissMs: mc > 0 ? Math.round(parseFloat(missTotalMs) / mc) : 0,
        recent:    recent.map(r => JSON.parse(r)),
        timeline:  timeline.map(s => JSON.parse(s)).reverse(),
        errors: {
            total:  parseInt(errTotal) || 0,
            recent: errRecent.map(e => JSON.parse(e)),
        },
        topPhrases,
    };
}

async function countCacheKeys() {
    let count = 0, cursor = '0';
    do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', cacheConfig.prefix + ':*', 'COUNT', 100);
        count += keys.length;
        cursor = next;
    } while (cursor !== '0');
    return count;
}

async function clearCacheKeys() {
    let deleted = 0, cursor = '0';
    do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', cacheConfig.prefix + ':*', 'COUNT', 100);
        if (keys.length) { await redis.del(...keys); deleted += keys.length; }
        cursor = next;
    } while (cursor !== '0');
    return deleted;
}

module.exports = { recordRequest, recordError, getStats, countCacheKeys, clearCacheKeys };
