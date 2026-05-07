const app = require('./src/app');
const redis = require('./src/redis');
const { port } = require('./src/config');
const logger = require('./src/logger');

const server = app.listen(port, () => {
    logger.info(`TTS API running on http://localhost:${port}`);
    logger.info('Endpoint: GET /request?text=<text>&lang=<ka|en>');
});

async function shutdown(signal) {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(async () => {
        await redis.quit();
        logger.info('Shutdown complete');
        process.exit(0);
    });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
