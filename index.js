const app = require('./src/app');
const { port } = require('./src/config');

app.listen(port, () => {
    console.log(`TTS API running on http://localhost:${port}`);
    console.log(`Endpoint: GET /request?text=<text>&lang=<ka|en>`);
});
