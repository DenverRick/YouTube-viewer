# YT Subscriptions

Self-hosted, RSS-based YouTube subscription manager. Organize channels into nested categories, set per-channel poll intervals, and watch via embedded YouTube player. Inspired by [Lon Seidman's custom interface](https://youtu.be/TO2NL_CcykA).

## Features
- RSS ingestion — no YouTube API key required
- Nested categories with per-channel poll intervals (default 1h, override per channel)
- OPML import/export for portability
- Optional HTTP Basic Auth (single user)
- SQLite storage, Docker-ready, always-on via launchd on macOS
- Embedded IFrame playback

---

## Option A — Run *this* app

### Prereqs
- Node.js 20+ (`brew install node`)
- Git

### Setup
```bash
git clone https://github.com/DenverRick/YouTube-viewer.git
cd YouTube-viewer
npm install
npm run build
```

### Run in dev (two servers, hot-reload)
```bash
npm run dev
# UI: http://localhost:5173   API: http://localhost:8787
```

### Run for real (single process, always-on)

**Docker:**
```bash
cp .env.example .env       # edit APP_USER / APP_PASS
docker compose up -d --build
# http://localhost:8787
```

**macOS launchd** (no Docker):
Create `~/Library/LaunchAgents/com.ytinterface.plist` with the path to your checkout, pick `APP_USER` / `APP_PASS`, set `RunAtLoad` + `KeepAlive` to true, then:
```bash
launchctl load ~/Library/LaunchAgents/com.ytinterface.plist
```
Access from any LAN device at `http://<your-mac-ip>:8787`.

### Seed channels
Three ways:
1. **UI** — click *Manage channels*, paste a channel URL / `@handle` / `UC...` id.
2. **OPML** — export from YouTube Takeout or another reader, import via the toolbar.
3. **Airtable importer** (Rick's workflow) — see `scripts/import-airtable.mjs`; edit the `ROWS` array and run `node scripts/import-airtable.mjs`.

---

## Option B — Build your own with Claude Code

This app took one Claude Code session, start to ship. The workflow:

1. **Pick a reference.** A specific video or description of an existing app gives Claude something concrete to clone. I pointed it at Lon Seidman's video outline.
2. **Use plan mode** (`/plan` or just ask "make a plan first"). Claude explores, asks a few multiple-choice clarifiers (stack, scope, playback style), and writes a plan file you approve before any code is written.
3. **Answer the clarifying questions.** Each answer locks in a real decision (Node vs Python, embed vs redirect playback, etc.) — this is where your taste shapes the app.
4. **Let it build.** Claude scaffolds the workspace, writes server + web code, installs dependencies, builds, and smoke-tests — all in one go.
5. **Deploy.** Ask for Docker, launchd, Tailscale, or public hosting. Same session.
6. **Iterate.** Add features (auth, bulk import from your data source, keyboard shortcuts) one conversation turn at a time.

### What made this quick
- **RSS instead of the YouTube Data API** — no OAuth, no quotas, no API key.
- **SQLite + single Fastify process** — no Postgres, no Redis, no queue.
- **Claude MCP for Airtable** — Claude read Rick's existing video library directly; no CSV export needed.

### What to steal
- `server/src/feeds/fetcher.ts` — RSS fetch with ETag/If-Modified-Since.
- `server/src/feeds/resolver.ts` — resolves a YouTube URL (channel, handle, or even a watch URL) to a `UC...` channel id by scraping the page.
- `server/src/feeds/scheduler.ts` — simple node-cron loop with per-item interval and concurrency cap.

---

## License
MIT — do whatever you want with this.
