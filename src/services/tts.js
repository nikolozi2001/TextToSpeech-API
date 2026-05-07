const fetch = require('node-fetch');
const https = require('https');
const { ttsUrl, requestTimeout } = require('../config');

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

function sanitizeText(text) {
    return text
        .replace(/(<([^>]+)>)/ig, '')  // strip HTML tags
        .replace(/&[a-z]+;/ig, ' ')    // strip HTML entities (&amp; &nbsp; etc.)
        .replace(/\s\s+/g, ' ')        // collapse whitespace
        .trim();
}

async function fetchTTS(text, lang) {
    const clean = sanitizeText(text);
    const isEnglish = lang === 'en';
    const body = `t=${encodeURIComponent(clean)}${isEnglish ? '&eng=true' : ''}`;

    const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        agent: insecureAgent,
        timeout: requestTimeout,
    });

    if (!response.ok) {
        const err = new Error(`Upstream error: ${response.status}`);
        err.status = 502;
        throw err;
    }

    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    return { buffer, contentType };
}

module.exports = { fetchTTS };
