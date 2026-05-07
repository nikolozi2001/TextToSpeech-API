const express = require('express');
const fetch = require('node-fetch');
const https = require('https');

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

const app = express();
const PORT = process.env.PORT || 3000;
const TTS_URL = 'https://ttsapi.tiflo.ge/tts.php';

app.get('/request', async (req, res) => {
    const { text, lang } = req.query;

    if (!text || !lang) {
        return res.status(400).send('App is empty');
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
