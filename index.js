require('dotenv').config();

const express = require('express');
const fetch = require('node-fetch');
const https = require('https');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const Redis = require('ioredis');

const app = express();
const PORT = process.env.PORT || 3000;
const TTS_URL = process.env.TTS_URL || 'https://ttsapi.tiflo.ge/tts.php';
const MAX_TEXT_LENGTH = 2000;
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 86400; // 24h
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 10_000;
const CACHE_PREFIX = process.env.CACHE_PREFIX || 'tts';

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

const redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
});

redis.on('error', (err) => console.error('Redis error:', err.message));

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: 'Too many requests, please try again later.',
}));

app.get('/health', async (req, res) => {
    let redisStatus = 'ok';
    try {
        await redis.ping();
    } catch {
        redisStatus = 'error';
    }
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()), redis: redisStatus });
});

app.get('/request', async (req, res) => {
    const { text, lang } = req.query;

    if (!text || !lang) {
        return res.status(400).send('App is empty');
    }

    if (text.length > MAX_TEXT_LENGTH) {
        return res.status(400).send(`Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`);
    }

    const cacheKey = `${CACHE_PREFIX}:${lang}:${text}`;

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

    const decodedText = decodeURIComponent(text);
    const isEnglish = lang === 'en';
    const body = `t=${encodeURIComponent(decodedText)}${isEnglish ? '&eng=true' : ''}`;

    try {
        const response = await fetch(TTS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
            agent: insecureAgent,
            timeout: REQUEST_TIMEOUT,
        });

        if (!response.ok) {
            return res.status(502).send(`Upstream error: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        res.setHeader('X-Cache', 'MISS');

        const buffer = await response.buffer();

        try {
            await redis.set(cacheKey, buffer, 'EX', CACHE_TTL);
        } catch (err) {
            console.error('Redis set error:', err.message);
        }

        res.send(buffer);
    } catch (err) {
        if (err.type === 'request-timeout') {
            return res.status(504).send('Upstream request timed out.');
        }
        res.status(500).send(`cURL Error #: ${err.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`TTS API running on http://localhost:${PORT}`);
    console.log(`Endpoint: GET /request?text=<text>&lang=<ka|en>`);
});
