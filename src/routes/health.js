const { Router } = require('express');
const redis = require('../redis');
const logger = require('../logger');

const router = Router();

router.get('/', async (req, res) => {
    let redisStatus = 'ok';
    try {
        await redis.ping();
    } catch (err) {
        logger.warn({ err: err.message }, 'Health check: Redis unavailable');
        redisStatus = 'error';
    }
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()), redis: redisStatus });
});

module.exports = router;
