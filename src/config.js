require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT) || 3000,
    ttsUrl: process.env.TTS_URL || 'https://ttsapi.tiflo.ge/tts.php',
    maxTextLength: 2000,
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 10_000,
    cache: {
        prefix: process.env.CACHE_PREFIX || 'tts',
        ttl: parseInt(process.env.CACHE_TTL) || 86400,
    },
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
    },
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    },
};
