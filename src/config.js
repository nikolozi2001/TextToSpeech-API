require('dotenv').config();

const { cleanEnv, port, str, num } = require('envalid');

const env = cleanEnv(process.env, {
    PORT:                  port({ default: 3000 }),
    TTS_URL:               str({ default: 'https://ttsapi.tiflo.ge/tts.php' }),
    REQUEST_TIMEOUT:       num({ default: 10_000 }),
    RATE_LIMIT_WINDOW_MS:  num({ default: 60_000 }),
    RATE_LIMIT_MAX:        num({ default: 100 }),
    REDIS_HOST:            str({ default: '127.0.0.1' }),
    REDIS_PORT:            port({ default: 6379 }),
    REDIS_PASSWORD:        str({ default: '' }),
    CACHE_TTL:             num({ default: 86400 }),
    CACHE_PREFIX:          str({ default: 'tts' }),
    LOG_LEVEL:             str({ default: 'info', choices: ['trace', 'debug', 'info', 'warn', 'error'] }),
    NODE_ENV:              str({ default: 'development', choices: ['development', 'production', 'test'] }),
});

module.exports = {
    port: env.PORT,
    ttsUrl: env.TTS_URL,
    maxTextLength: 2000,
    requestTimeout: env.REQUEST_TIMEOUT,
    nodeEnv: env.NODE_ENV,
    cache: {
        prefix: env.CACHE_PREFIX,
        ttl: env.CACHE_TTL,
    },
    redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
    },
    rateLimit: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        max: env.RATE_LIMIT_MAX,
    },
};
