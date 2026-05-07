# TextToSpeech API

A lightweight Node.js/Express proxy API that converts text to speech using the tiflo.ge TTS service, with support for Georgian and English languages.

## Endpoint

```
GET /request?text=<text>&lang=<ka|en>
```

### Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `text`    | Yes      | URL-encoded text to convert to speech |
| `lang`    | Yes      | Language code: `ka` for Georgian, `en` for English |

### Example

```bash
curl "http://localhost:3000/request?text=Hello%20World&lang=en" --output audio.mp3
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+

### Installation

```bash
npm install
```

### Running

```bash
npm start
```

The server starts on `http://localhost:3000` by default. Override the port with the `PORT` environment variable:

```bash
PORT=8080 npm start
```

## Dependencies

- [express](https://expressjs.com/) — HTTP server
- [node-fetch](https://github.com/node-fetch/node-fetch) — HTTP client for upstream TTS requests

## License

ISC
