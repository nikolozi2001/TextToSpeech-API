const { Router } = require('express');
const crypto = require('crypto');
const redis = require('../redis');
const { fetchTTS } = require('../services/tts');
const { recordRequest } = require('../metrics');
const { maxTextLength, cache } = require('../config');
const logger = require('../logger');

const router = Router();

function buildCacheKey(lang, text) {
    const hash = crypto.createHash('md5').update(`${lang}:${text}`).digest('hex');
    return `${cache.prefix}:${hash}`;
}

router.get('/', async (req, res) => {
    const start = Date.now();
    const { text, lang } = req.query;

    if (!text || !lang) {
        return res.status(400).send('App is empty');
    }

    if (text.length > maxTextLength) {
        return res.status(400).send(`Text exceeds maximum length of ${maxTextLength} characters.`);
    }

    const cacheKey = buildCacheKey(lang, text);

    try {
        const cached = await redis.getBuffer(cacheKey);
        if (cached) {
            const durationMs = Date.now() - start;
            logger.debug({ cacheKey }, 'Cache HIT');
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('X-Cache', 'HIT');
            recordRequest({ text, lang, cacheHit: true, durationMs }).catch(() => {});
            return res.send(cached);
        }
    } catch (err) {
        logger.warn({ err: err.message }, 'Redis get error');
    }

    try {
        const { buffer, contentType } = await fetchTTS(decodeURIComponent(text), lang);
        const durationMs = Date.now() - start;

        res.setHeader('Content-Type', contentType);
        res.setHeader('X-Cache', 'MISS');

        try {
            await redis.set(cacheKey, buffer, 'EX', cache.ttl);
            logger.debug({ cacheKey }, 'Cache SET');
        } catch (err) {
            logger.warn({ err: err.message }, 'Redis set error');
        }

        recordRequest({ text, lang, cacheHit: false, durationMs }).catch(() => {});
        res.send(buffer);
    } catch (err) {
        if (err.type === 'request-timeout') {
            logger.error('Upstream request timed out');
            return res.status(504).send('Upstream request timed out.');
        }
        logger.error({ err: err.message }, 'TTS fetch error');
        res.status(err.status || 500).send(err.message || 'Internal server error.');
    }
});

module.exports = router;
