const Redis = require('ioredis');
const { redis: redisConfig } = require('./config');
const logger = require('./logger');

const client = new Redis({ ...redisConfig, lazyConnect: true });

client.on('error', (err) => logger.error({ err: err.message }, 'Redis error'));

module.exports = client;
