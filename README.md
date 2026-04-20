# YT Subscriptions

Self-hosted, RSS-based YouTube subscription manager. Organize channels into nested categories, set per-channel poll intervals, and watch via embedded YouTube player. Inspired by Lon Seidman's custom interface.

## Features
- RSS ingestion (no YouTube API key required)
- Nested categories with drag-free filtering
- Per-channel poll interval (default 1h)
- OPML import/export
- Docker deploy with persistent SQLite volume
- Embedded YouTube IFrame playback

## Dev

```
npm install
npm run dev
# API: http://localhost:8787   UI: http://localhost:5173
```

## Production (Docker)

```
docker compose up --build
# http://localhost:8787
```

SQLite lives in `./data/app.db`.
