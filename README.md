# Claude Access Monitor

Real-time visibility into every tool call Claude Code makes — file reads, shell commands, web requests, and more — streamed to a hosted dashboard, isolated per user by API key.

```
Your machine                          Hosted (you deploy once)
────────────────────────────────      ──────────────────────────────────
Claude Code                           backend/   (Railway / Render)
  └── hook fires on every tool call        │
        └── POST /events + API key ────────┤  stores per-key in SQLite
                                           │
                              frontend/   (Vercel / Netlify)
                                ConnectScreen → live dashboard
```

---

## Repo structure

```
claude-monitor/
├── agent/                  pip-installable hook agent (users install this)
│   ├── pyproject.toml
│   └── claude_monitor/
│       ├── hook.py         Claude Code PreToolUse hook
│       ├── cli.py          claude-monitor CLI
│       ├── setup.py        wires the hook into ~/.claude/settings.json
│       ├── viewer.py       fallback log viewer
│       └── config.py       reads ~/.claude/claude_monitor.json
│
├── backend/                FastAPI API server (deploy to Railway / Render)
│   ├── server.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/               React dashboard (deploy to Vercel / Netlify)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   └── components/
│   ├── .env.example
│   └── vite.config.js
│
└── README.md
```

---

## 1 — Deploy the backend

### Railway (recommended)

1. Push this repo to GitHub.
2. Create a new Railway project → **Deploy from GitHub repo**.
3. Set the **Root Directory** to `backend`.
4. Railway auto-detects the Dockerfile and deploys.
5. Copy the public URL (e.g. `https://claude-monitor.up.railway.app`).

### Render

1. New Web Service → connect your GitHub repo.
2. Root Directory: `backend`
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn server:app --host 0.0.0.0 --port 8765`

### Run locally

```bash
cd backend
pip install -r requirements.txt
python server.py
# API available at http://localhost:8765
```

---

## 2 — Deploy the frontend

### Vercel (recommended)

1. Import your GitHub repo in Vercel.
2. Set **Root Directory** to `frontend`.
3. Add environment variable:
   ```
   VITE_SERVER_URL=https://your-backend-url.railway.app
   ```
4. Build Command: `npm run build`  
   Output Directory: `dist`
5. Deploy — Vercel gives you a URL like `https://claude-monitor.vercel.app`.

### Netlify

Same settings: root `frontend`, build `npm run build`, publish `dist`, add `VITE_SERVER_URL`.

### Run locally

```bash
cd frontend
cp .env.example .env          # edit VITE_SERVER_URL
npm install
npm run dev                   # http://localhost:3000
```

> The Vite dev server proxies `/api` and `/ws` to `http://localhost:8765` automatically.

---

## 3 — Install the agent (users do this once)

### Install

```bash
pip install claude-monitor-agent
```

> Not on PyPI yet? Install directly from the repo:
> ```bash
> pip install git+https://github.com/your-org/claude-monitor.git#subdirectory=agent
> ```

### Generate an API key

```bash
python -c "import uuid; print(uuid.uuid4())"
# e.g. f47ac10b-58cc-4372-a567-0e02b2c3d479
```

### Configure

```bash
claude-monitor setup \
  --server-url https://your-backend-url.railway.app \
  --key f47ac10b-58cc-4372-a567-0e02b2c3d479
```

This writes `~/.claude/claude_monitor.json` and adds the hook to `~/.claude/settings.json`.

### Restart Claude Code

The hook activates after a restart. Every tool call will now stream to your dashboard.

### Verify

```bash
claude-monitor status        # show current config
claude-monitor view          # view fallback log (when server unreachable)
claude-monitor view --stats  # category breakdown
```

---

## 4 — Open the dashboard

1. Go to your Vercel URL.
2. Enter your backend URL and API key on the Connect screen.
3. Click **Connect** — the dashboard loads your live event stream.

Each API key sees only its own data. Share a key with a teammate to share a view.

---

## Data isolation

Every event is tagged with the API key that posted it. Queries always filter by key — users can never see each other's data.

```
POST /events          X-Api-Key: <key>  →  stored as owner_key = key
GET  /api/events      X-Api-Key: <key>  →  returns only rows WHERE owner_key = key
GET  /api/stats       X-Api-Key: <key>  →  stats only for that key
```

`GET /health` requires no key (used by the Connect screen to test reachability).

---

## Deployment summary

| Part | Host | Config |
|---|---|---|
| `backend/` | Railway / Render | Root dir: `backend` |
| `frontend/` | Vercel / Netlify | Root dir: `frontend`, env: `VITE_SERVER_URL` |
| `agent/` | Users' machines | `pip install` + `claude-monitor setup` |

---

## Fallback behaviour

If the backend is unreachable, the agent writes events to `~/.claude/claude_monitor_fallback.jsonl` instead of dropping them. View with `claude-monitor view`.
