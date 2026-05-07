# TextToSpeech API

A lightweight Node.js/Express proxy API that converts text to speech using the tiflo.ge TTS service, with support for Georgian and English languages.

## Features

- Georgian and English TTS via tiflo.ge
- Redis caching (MD5-hashed keys, configurable TTL)
- Rate limiting per IP
- Security headers via Helmet
- CORS support
- Structured logging via Pino
- Request timeout handling
- Startup environment validation
- Graceful shutdown
- Docker support

## Project Structure

```
index.js              ← entry point
src/
  app.js              ← middleware + routes
  config.js           ← environment validation & config
  logger.js           ← pino logger
  redis.js            ← redis client
  routes/
    health.js         ← GET /health
    tts.js            ← GET /request
  services/
    tts.js            ← upstream fetch logic
```

## Endpoints

### `GET /request`

Convert text to speech. Returns audio binary.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `text`    | Yes      | URL-encoded text to convert |
| `lang`    | Yes      | `ka` for Georgian, `en` for English |

```bash
curl "http://localhost:3000/request?text=გამარჯობა&lang=ka" --output audio.mp3
curl "http://localhost:3000/request?text=Hello%20World&lang=en" --output audio.mp3
```

**Response headers:**
- `X-Cache: HIT` — served from Redis cache
- `X-Cache: MISS` — fetched from upstream

### `GET /health`

Returns server and Redis status.

```json
{ "status": "ok", "uptime": 42, "redis": "ok" }
```

## Getting Started

### Option 1 — Docker (recommended)

Starts the API and Redis together:

```bash
docker compose up -d
```

### Option 2 — Local

**Prerequisites:** Node.js v18+, Redis running on `localhost:6379`

```bash
# Install dependencies
npm install

# Production
npm start

# Development (auto-restart on file change)
npm run dev
```

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

| Variable               | Default                            | Description                        |
|------------------------|------------------------------------|------------------------------------|
| `PORT`                 | `3000`                             | Server port                        |
| `TTS_URL`              | `https://ttsapi.tiflo.ge/tts.php`  | Upstream TTS service URL           |
| `REQUEST_TIMEOUT`      | `10000`                            | Upstream timeout in ms             |
| `RATE_LIMIT_WINDOW_MS` | `60000`                            | Rate limit window in ms            |
| `RATE_LIMIT_MAX`       | `100`                              | Max requests per window per IP     |
| `REDIS_HOST`           | `127.0.0.1`                        | Redis host                         |
| `REDIS_PORT`           | `6379`                             | Redis port                         |
| `REDIS_PASSWORD`       | ` `                                | Redis password (optional)          |
| `CACHE_TTL`            | `86400`                            | Cache TTL in seconds (24h)         |
| `CACHE_PREFIX`         | `tts`                              | Redis key prefix (for multi-app)   |
| `NODE_ENV`             | `development`                      | `development` or `production`      |
| `LOG_LEVEL`            | `info`                             | `trace` `debug` `info` `warn` `error` |

### Sharing Redis with another app

Each app should use a unique `CACHE_PREFIX` to avoid key collisions:

```env
# App 1
CACHE_PREFIX=tts

# App 2
CACHE_PREFIX=inflation
```

## Dependencies

| Package              | Purpose                        |
|----------------------|--------------------------------|
| `express`            | HTTP server                    |
| `node-fetch`         | Upstream TTS requests          |
| `ioredis`            | Redis client                   |
| `express-rate-limit` | Rate limiting                  |
| `helmet`             | Security headers               |
| `cors`               | Cross-origin requests          |
| `morgan`             | HTTP request logging           |
| `pino`               | Structured logger              |
| `pino-pretty`        | Human-readable logs in dev     |
| `dotenv`             | Load `.env` file               |
| `envalid`            | Environment variable validation|

## License

ISC
