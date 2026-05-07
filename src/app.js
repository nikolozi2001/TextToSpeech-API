const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { rateLimit: rateLimitConfig } = require('./config');

const healthRouter = require('./routes/health');
const ttsRouter = require('./routes/tts');
const dashboardRouter = require('./routes/dashboard');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(rateLimit({
    ...rateLimitConfig,
    message: 'Too many requests, please try again later.',
}));

app.get('/', (req, res) => res.redirect('/dashboard'));
app.use('/health', healthRouter);
app.use('/request', ttsRouter);
app.use('/dashboard', dashboardRouter);

module.exports = app;
