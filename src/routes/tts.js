const { Router } = require('express');
const redis = require('../redis');
const { fetchTTS } = require('../services/tts');
const { maxTextLength, cache } = require('../config');

const router = Router();

router.get('/', async (req, res) => {
    const { text, lang } = req.query;

    if (!text || !lang) {
        return res.status(400).send('App is empty');
    }

    if (text.length > maxTextLength) {
        return res.status(400).send(`Text exceeds maximum length of ${maxTextLength} characters.`);
    }

    const cacheKey = `${cache.prefix}:${lang}:${text}`;

    try {
        const cached = await redis.getBuffer(cacheKey);
        if (cached) {
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('X-Cache', 'HIT');
            return res.send(cached);
        }
    } catch (err) {
        console.error('Redis get error:', err.message);
    }

    try {
        const { buffer, contentType } = await fetchTTS(decodeURIComponent(text), lang);

        res.setHeader('Content-Type', contentType);
        res.setHeader('X-Cache', 'MISS');

        try {
            await redis.set(cacheKey, buffer, 'EX', cache.ttl);
        } catch (err) {
            console.error('Redis set error:', err.message);
        }

        res.send(buffer);
    } catch (err) {
        if (err.type === 'request-timeout') {
            return res.status(504).send('Upstream request timed out.');
        }
        const status = err.status || 500;
        res.status(status).send(err.message || 'Internal server error.');
    }
});

module.exports = router;
