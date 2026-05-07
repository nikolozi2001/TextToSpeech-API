const redis = require('./redis');

const KEYS = {
    total:   'metrics:total',
    hits:    'metrics:hits',
    misses:  'metrics:misses',
    recent:  'metrics:recent',
};

const MAX_RECENT = 20;

async function recordRequest({ text, lang, cacheHit, durationMs }) {
    const entry = JSON.stringify({
        text: text.length > 60 ? text.substring(0, 60) + '...' : text,
        lang,
        cacheHit,
        durationMs,
        ts: Date.now(),
    });

    await redis.pipeline()
        .incr(KEYS.total)
        .incr(cacheHit ? KEYS.hits : KEYS.misses)
        .lpush(KEYS.recent, entry)
        .ltrim(KEYS.recent, 0, MAX_RECENT - 1)
        .exec();
}

async function getStats() {
    const [total, hits, misses, recent] = await Promise.all([
        redis.get(KEYS.total),
        redis.get(KEYS.hits),
        redis.get(KEYS.misses),
        redis.lrange(KEYS.recent, 0, -1),
    ]);

    return {
        total:  parseInt(total)  || 0,
        hits:   parseInt(hits)   || 0,
        misses: parseInt(misses) || 0,
        recent: recent.map(r => JSON.parse(r)),
    };
}

module.exports = { recordRequest, getStats };
