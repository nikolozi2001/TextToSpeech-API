const Redis = require('ioredis');
const { redis: redisConfig } = require('./config');

const client = new Redis({ ...redisConfig, lazyConnect: true });

client.on('error', (err) => console.error('Redis error:', err.message));

module.exports = client;
