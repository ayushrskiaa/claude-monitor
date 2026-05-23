# Claude Access Monitor

Real-time visibility into every tool call Claude Code makes — streamed to a dashboard, isolated per user by API key.

```
Your machine                           Hosting
──────────────────────────────         ───────────────────────────────────
Claude Code                            Backend (FastAPI + SQLite)
  └── hook fires on every tool          stores events per API key
        └── POST /events + key ──────►         │
                                               │ WebSocket push
                                       Frontend (React + Vite)
                                         Connect screen -> live dashboard
```

---

## Repo structure

```
claude-monitor/
├── agent/               pip package — install locally
│   ├── pyproject.toml
│   └── claude_monitor/
│       ├── hook.py      Claude Code PreToolUse hook (run by Claude on every tool call)
│       ├── cli.py       claude-monitor CLI (setup / view / status)
│       ├── setup.py     wires hook into ~/.claude/settings.json
│       ├── viewer.py    fallback log viewer
│       └── config.py   reads/writes ~/.claude/claude_monitor.json
│
├── backend/             FastAPI server
│   ├── server.py        multi-tenant API + WebSocket + SQLite
│   ├── requirements.txt
│   ├── Dockerfile
│   └── fly.toml
│
├── frontend/            React app
│   ├── src/
│   │   ├── App.jsx      root component — state, WS, data fetching
│   │   ├── api.js       fetch helpers (reads server URL + key from localStorage)
│   │   ├── constants.js category colours and labels
│   │   ├── utils.js     formatting helpers
│   │   └── components/
│   │       ├── ConnectScreen.jsx   first-run login form
│   │       ├── Header.jsx          WS status dot + export dropdown
│   │       ├── StatsRow.jsx        total / flagged / sessions / top tool
│   │       ├── FilterBar.jsx       session / category / flagged / search filters
│   │       ├── Feed.jsx            scrollable event list with Load More
│   │       ├── SidePanel.jsx       charts + recent alerts
│   │       ├── CategoryChart.jsx   recharts donut
│   │       ├── TimelineChart.jsx   recharts bar (events/hour, 24 h)
│   │       ├── TopTools.jsx        horizontal bar rows
│   │       ├── AlertsList.jsx      recent flagged events
│   │       ├── DetailModal.jsx     raw JSON for a selected event
│   │       └── SettingsModal.jsx   edit server URL / key in-app
│   ├── .env.example
│   └── vite.config.js
│
└── README.md
```

---

## Run locally

### 1 — Start the backend

```bash
cd backend
pip install -r requirements.txt
python server.py
# runs on http://localhost:8765
```

### 2 — Start the frontend

Requires **Node.js 18+**. The project uses Vite 4.x (pinned for Node.js compatibility).

```bash
cd frontend
npm install
npm run dev
# open http://localhost:3000
```

### 3 — Install the agent

```bash
cd agent
pip install -e .
```

> **Windows:** if `claude-monitor` is not found after install, add the Scripts folder to PATH:
> ```powershell
> [Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";C:\Users\<you>\AppData\Roaming\Python\Python3XX\Scripts", "User")
> ```

### 4 — Generate an API key

```bash
python -c "import uuid; print(uuid.uuid4())"
# e.g. f47ac10b-58cc-4372-a567-0e02b2c3d479
```

Each user needs their own key. Keep it private.

### 5 — Configure the agent

```bash
claude-monitor setup \
  --server-url http://localhost:8765 \
  --key f47ac10b-58cc-4372-a567-0e02b2c3d479
```

This writes `~/.claude/claude_monitor.json` and registers the hook in `~/.claude/settings.json`.

**Restart Claude Code** — the hook takes effect after a restart.

### 6 — Open the dashboard

1. Go to `http://localhost:3000`
2. Enter **Server URL**: `http://localhost:8765`
3. Enter **API Key**: your UUID
4. Click **Connect**

---

## Deploy (hosted)

### Backend — Fly.io

Fly.io requires a credit card for verification (free tier, no charge for small usage).

```bash
cd backend

# Create app (uses fly.toml config)
fly apps create <your-app-name>

# Create persistent volume for SQLite
fly volumes create monitor_data --size 1 --region iad --app <your-app-name>

# Deploy
fly deploy --app <your-app-name>
```

Your backend URL: `https://<your-app-name>.fly.dev`

### Backend — Cloudflare Tunnel (free, no credit card)

Run the backend locally and expose it publicly via Cloudflare:

```bash
# Terminal 1 — run backend
cd backend && python server.py

# Terminal 2 — expose it
cloudflared tunnel --url http://localhost:8765
```

Cloudflare prints a public HTTPS URL — use that as your server URL.
Download cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

### Frontend — Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) → import your repo.
3. Set **Root Directory** to `frontend`.
4. Add environment variable:
   ```
   VITE_SERVER_URL = https://<your-backend-url>
   ```
5. Framework Preset: **Vite** | Build: `npm run build` | Output: `dist`
6. Click **Deploy**.

---

## How data isolation works

Every event is tagged with the API key that posted it:

```
POST /events  X-Api-Key: alice-key  ->  stored with owner_key = "alice-key"
GET  /api/*   X-Api-Key: alice-key  ->  returns only rows WHERE owner_key = "alice-key"
WS  /ws?key=alice-key              ->  receives only alice's events in real-time
```

`GET /health` requires no key — used by the Connect screen to verify connectivity.

---

## Fallback & debugging

If the backend is unreachable, the agent writes to `~/.claude/claude_monitor_fallback.jsonl` instead of dropping events.

```bash
claude-monitor view          # view fallback log
claude-monitor view -f       # flagged events only
claude-monitor view --stats  # category breakdown
claude-monitor status        # show current config
```

For hook-level debugging, check `~/.claude/claude_monitor_debug.log` — the hook appends a line for every Claude Code tool call it processes.

---

## Sensitive file detection

The hook automatically flags events that touch paths matching these patterns:

```
\.env  id_rsa  \.ssh  credentials  token  password  \.aws  \.pem
```

Flagged events appear highlighted in the dashboard and are surfaced in the **Recent Alerts** panel. You can customise the patterns in `~/.claude/claude_monitor.json` under `sensitive_patterns`.
