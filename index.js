require('dotenv').config();

const express = require('express');
const fetch = require('node-fetch');
const https = require('https');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const TTS_URL = process.env.TTS_URL || 'https://ttsapi.tiflo.ge/tts.php';
const MAX_TEXT_LENGTH = 2000;

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

app.use(cors());
app.use(morgan('dev'));
app.use(rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 30,
    message: 'Too many requests, please try again later.',
}));

app.get('/request', async (req, res) => {
    const { text, lang } = req.query;

    if (!text || !lang) {
        return res.status(400).send('App is empty');
    }

    if (text.length > MAX_TEXT_LENGTH) {
        return res.status(400).send(`Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`);
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
        });

        if (!response.ok) {
            return res.status(502).send(`Upstream error: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);

        response.body.pipe(res);
    } catch (err) {
        res.status(500).send(`cURL Error #: ${err.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`TTS API running on http://localhost:${PORT}`);
    console.log(`Endpoint: GET /request?text=<text>&lang=<ka|en>`);
});
