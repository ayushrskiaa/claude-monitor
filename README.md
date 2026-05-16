# Claude Access Monitor

Real-time visibility into every tool call Claude Code makes — streamed to a hosted dashboard, isolated per user by API key.

```
Your machine                           Free hosting
──────────────────────────────         ───────────────────────────────────
Claude Code                            Fly.io  (backend)
  └── hook fires on every tool          stores events per API key in SQLite
        └── POST /events + key ──────►         │
                                               │ WebSocket push
                                       Vercel  (frontend)
                                         Connect screen → live dashboard
```

---

## Repo structure

```
claude-monitor/
├── agent/               pip package — users install this locally
│   ├── pyproject.toml
│   └── claude_monitor/
│       ├── hook.py      Claude Code PreToolUse hook
│       ├── cli.py       claude-monitor CLI
│       ├── setup.py     wires hook into ~/.claude/settings.json
│       ├── viewer.py    fallback log viewer
│       └── config.py   reads ~/.claude/claude_monitor.json
│
├── backend/             FastAPI server — deploy to Fly.io
│   ├── server.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── fly.toml
│
├── frontend/            React app — deploy to Vercel
│   ├── src/
│   ├── .env.example
│   └── vite.config.js
│
└── README.md
```

---

## 1 — Deploy the backend (Fly.io — free)

[fly.io](https://fly.io) free tier: always-on, WebSockets, persistent disk. No credit card for hobby use.

### First time

```bash
# Install the Fly CLI
curl -L https://fly.io/install.sh | sh    # macOS / Linux
# Windows: https://fly.io/docs/flyctl/install/

fly auth signup      # or fly auth login

cd backend
fly launch           # detects Dockerfile, creates app — say NO to Postgres
```

When prompted for an app name, use something like `claude-monitor-backend`. Note the URL it gives you (e.g. `https://claude-monitor-backend.fly.dev`).

```bash
# Create a 1 GB persistent volume to store monitor.db
fly volumes create monitor_data --size 1 --region iad

# Deploy
fly deploy
```

### Redeploy after changes

```bash
cd backend
fly deploy
```

### Check logs

```bash
fly logs
```

---

## 2 — Deploy the frontend (Vercel — free)

[vercel.com](https://vercel.com) free hobby plan: unlimited deploys, global CDN.

### Setup

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) → import your GitHub repo.
3. Set **Root Directory** to `frontend`.
4. Add environment variable:
   ```
   VITE_SERVER_URL = https://claude-monitor-backend.fly.dev
   ```
5. Framework Preset: **Vite**  
   Build Command: `npm run build`  
   Output Directory: `dist`
6. Click **Deploy**.

Vercel gives you a URL like `https://claude-monitor.vercel.app` — this is what you share with users.

### Redeploy after changes

Push to GitHub — Vercel redeploys automatically.

---

## 3 — Install the agent (users do this once)

### Install

```bash
pip install claude-monitor-agent
```

> Not on PyPI yet? Install from the repo:
> ```bash
> pip install "git+https://github.com/your-org/claude-monitor.git#subdirectory=agent"
> ```

### Generate an API key

```bash
python -c "import uuid; print(uuid.uuid4())"
# e.g.  f47ac10b-58cc-4372-a567-0e02b2c3d479
```

Each user needs their own key. Keep it private — it controls who sees your data.

### Configure

```bash
claude-monitor setup \
  --server-url https://claude-monitor-backend.fly.dev \
  --key f47ac10b-58cc-4372-a567-0e02b2c3d479
```

This writes `~/.claude/claude_monitor.json` and adds the hook to `~/.claude/settings.json`.

**Restart Claude Code** — the hook takes effect after a restart.

### Verify

```bash
claude-monitor status        # show current config
claude-monitor view          # view fallback log
claude-monitor view --stats  # category breakdown
```

---

## 4 — Open the dashboard

1. Go to your Vercel URL.
2. On the Connect screen, enter:
   - **Server URL**: `https://claude-monitor-backend.fly.dev`
   - **API Key**: your UUID key
3. Click **Connect**.

Each key sees only its own data.

---

## How data isolation works

Every event is tagged with the API key that posted it:

```
POST /events  X-Api-Key: alice-key  →  stored with owner_key = "alice-key"
GET  /api/*   X-Api-Key: alice-key  →  returns only rows WHERE owner_key = "alice-key"
```

`GET /health` needs no key — used by the Connect screen to verify the server is reachable.

---

## Fallback

If the Fly.io backend is unreachable, the agent writes to `~/.claude/claude_monitor_fallback.jsonl` instead of dropping events. View with `claude-monitor view`.

---

## Local development

```bash
# Terminal 1 — backend
cd backend && pip install -r requirements.txt && python server.py

# Terminal 2 — frontend (proxies /api and /ws to localhost:8765)
cd frontend && npm install && npm run dev
# open http://localhost:3000
```
