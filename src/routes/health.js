const { Router } = require('express');
const redis = require('../redis');

const router = Router();

router.get('/', async (req, res) => {
    let redisStatus = 'ok';
    try {
        await redis.ping();
    } catch {
        redisStatus = 'error';
    }
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()), redis: redisStatus });
});

module.exports = router;
