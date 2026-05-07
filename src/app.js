const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { rateLimit: rateLimitConfig } = require('./config');

const healthRouter = require('./routes/health');
const ttsRouter = require('./routes/tts');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(rateLimit({
    ...rateLimitConfig,
    message: 'Too many requests, please try again later.',
}));

app.use('/health', healthRouter);
app.use('/request', ttsRouter);

module.exports = app;
