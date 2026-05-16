#!/usr/bin/env python3
"""
Claude Access Monitor - Multi-tenant Backend
Each user's data is isolated by their API key.
Deploy to Railway / Render / Fly.io, then point the agent at the URL.

Run locally:  python server.py
              python -m uvicorn server:app --host 0.0.0.0 --port 8765 --reload
"""

import asyncio
import json
import os
import sqlite3
import threading
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

SCRIPT_DIR = Path(__file__).parent
DB_PATH    = Path(os.getenv("DATA_DIR", str(SCRIPT_DIR))) / "monitor.db"

_db_lock = threading.Lock()


# ── Auth ──────────────────────────────────────────────────────────────────────

def require_key(x_api_key: Optional[str] = Header(None)) -> str:
    """Every data endpoint requires X-Api-Key. The key IS the user identity."""
    if not x_api_key:
        raise HTTPException(
            status_code=401,
            detail="X-Api-Key header required. "
                   "Generate a key with: python -c \"import uuid; print(uuid.uuid4())\"",
        )
    return x_api_key


# ── WebSocket manager ─────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        # api_key → list of WebSocket connections
        self._conns: dict[str, list[WebSocket]] = {}

    async def connect(self, ws: WebSocket, key: str):
        await ws.accept()
        self._conns.setdefault(key, []).append(ws)

    def disconnect(self, ws: WebSocket, key: str):
        lst = self._conns.get(key, [])
        if ws in lst:
            lst.remove(ws)

    async def broadcast(self, key: str, data: dict):
        dead = []
        for ws in list(self._conns.get(key, [])):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, key)

    def count(self, key: str) -> int:
        return len(self._conns.get(key, []))


manager = ConnectionManager()


# ── Database ──────────────────────────────────────────────────────────────────

def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c


def db_init():
    with _db_lock:
        c = _conn()
        c.executescript("""
            CREATE TABLE IF NOT EXISTS events (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_key   TEXT    NOT NULL,
                timestamp   TEXT    NOT NULL,
                session_id  TEXT    NOT NULL,
                tool        TEXT    NOT NULL,
                category    TEXT    NOT NULL,
                summary     TEXT    DEFAULT '',
                paths       TEXT    DEFAULT '[]',
                flagged     INTEGER DEFAULT 0,
                input       TEXT    DEFAULT '{}',
                hostname    TEXT    DEFAULT '',
                working_dir TEXT    DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_owner    ON events(owner_key);
            CREATE INDEX IF NOT EXISTS idx_ts       ON events(owner_key, timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_session  ON events(owner_key, session_id);
            CREATE INDEX IF NOT EXISTS idx_flagged  ON events(owner_key, flagged);
            CREATE INDEX IF NOT EXISTS idx_category ON events(owner_key, category);
        """)
        c.commit()
        c.close()


def _parse(row) -> dict:
    e = dict(row)
    e["paths"] = json.loads(e.get("paths") or "[]")
    e["input"]  = json.loads(e.get("input")  or "{}")
    return e


def db_insert(owner_key: str, event: dict):
    with _db_lock:
        c = _conn()
        try:
            c.execute(
                "INSERT INTO events (owner_key,timestamp,session_id,tool,category,summary,paths,flagged,input,hostname,working_dir) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (
                    owner_key,
                    event.get("timestamp", datetime.now(timezone.utc).isoformat()),
                    event.get("session_id", "unknown"),
                    event.get("tool",       "Unknown"),
                    event.get("category",   "unknown"),
                    event.get("summary",    ""),
                    json.dumps(event.get("paths", [])),
                    1 if event.get("flagged") else 0,
                    json.dumps(event.get("input", {})),
                    event.get("hostname",    ""),
                    event.get("working_dir", ""),
                ),
            )
            c.commit()
        finally:
            c.close()


def db_query_events(
    owner_key:  str,
    limit:      int  = 100,
    offset:     int  = 0,
    session_id: Optional[str]  = None,
    category:   Optional[str]  = None,
    tool:       Optional[str]  = None,
    flagged:    Optional[bool] = None,
    search:     Optional[str]  = None,
) -> tuple[list[dict], int]:
    conds  = ["owner_key = ?"]
    params = [owner_key]
    if session_id: conds.append("session_id = ?");  params.append(session_id)
    if category:   conds.append("category = ?");    params.append(category)
    if tool:       conds.append("tool = ?");        params.append(tool)
    if flagged is not None:
        conds.append("flagged = ?"); params.append(1 if flagged else 0)
    if search:
        conds.append("(summary LIKE ? OR tool LIKE ? OR session_id LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

    where = "WHERE " + " AND ".join(conds)
    with _db_lock:
        c = _conn()
        try:
            total = c.execute(f"SELECT COUNT(*) FROM events {where}", params).fetchone()[0]
            rows  = c.execute(
                f"SELECT * FROM events {where} ORDER BY id DESC LIMIT ? OFFSET ?",
                params + [limit, offset],
            ).fetchall()
            return [_parse(r) for r in rows], total
        finally:
            c.close()


def db_stats(owner_key: str) -> dict:
    with _db_lock:
        c = _conn()
        try:
            ok = ("owner_key = ?", [owner_key])
            total    = c.execute(f"SELECT COUNT(*) FROM events WHERE {ok[0]}", ok[1]).fetchone()[0]
            flagged  = c.execute(f"SELECT COUNT(*) FROM events WHERE {ok[0]} AND flagged=1", ok[1]).fetchone()[0]
            sessions = c.execute(f"SELECT COUNT(DISTINCT session_id) FROM events WHERE {ok[0]}", ok[1]).fetchone()[0]
            by_cat   = [dict(r) for r in c.execute(
                f"SELECT category, COUNT(*) count FROM events WHERE {ok[0]} GROUP BY category ORDER BY count DESC",
                ok[1],
            ).fetchall()]
            by_tool  = [dict(r) for r in c.execute(
                f"SELECT tool, COUNT(*) count FROM events WHERE {ok[0]} GROUP BY tool ORDER BY count DESC LIMIT 10",
                ok[1],
            ).fetchall()]
            timeline = [dict(r) for r in c.execute(
                f"SELECT strftime('%Y-%m-%dT%H:00:00', timestamp) hour, COUNT(*) count "
                f"FROM events WHERE {ok[0]} AND timestamp >= datetime('now','-24 hours') "
                f"GROUP BY hour ORDER BY hour",
                ok[1],
            ).fetchall()]
            recent_flagged = [_parse(r) for r in c.execute(
                f"SELECT * FROM events WHERE {ok[0]} AND flagged=1 ORDER BY id DESC LIMIT 10",
                ok[1],
            ).fetchall()]
            return {
                "total": total, "flagged": flagged, "sessions": sessions,
                "by_category": by_cat, "by_tool": by_tool,
                "timeline": timeline, "recent_flagged": recent_flagged,
            }
        finally:
            c.close()


def db_sessions(owner_key: str) -> list[dict]:
    with _db_lock:
        c = _conn()
        try:
            return [dict(r) for r in c.execute(
                "SELECT session_id, COUNT(*) event_count, SUM(flagged) flagged_count, "
                "MIN(timestamp) first_seen, MAX(timestamp) last_seen "
                "FROM events WHERE owner_key = ? GROUP BY session_id ORDER BY last_seen DESC",
                [owner_key],
            ).fetchall()]
        finally:
            c.close()


# ── App ───────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    db_init()
    print("[monitor] Backend ready on :8765")
    yield


app = FastAPI(title="Claude Access Monitor", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """No auth — used by the frontend to test connectivity."""
    return {"status": "ok"}


@app.post("/events")
async def ingest(event: dict, owner: str = Depends(require_key)):
    await asyncio.to_thread(db_insert, owner, event)
    await manager.broadcast(owner, {"type": "event", "data": event})
    return {"ok": True}


@app.get("/api/events")
async def list_events(
    owner:      str  = Depends(require_key),
    limit:      int  = Query(100, ge=1, le=1000),
    offset:     int  = Query(0, ge=0),
    session_id: Optional[str]  = None,
    category:   Optional[str]  = None,
    tool:       Optional[str]  = None,
    flagged:    Optional[bool] = None,
    search:     Optional[str]  = None,
):
    events, total = await asyncio.to_thread(
        db_query_events, owner, limit, offset, session_id, category, tool, flagged, search
    )
    return {"events": events, "total": total, "limit": limit, "offset": offset}


@app.get("/api/stats")
async def get_stats(owner: str = Depends(require_key)):
    return await asyncio.to_thread(db_stats, owner)


@app.get("/api/sessions")
async def get_sessions(owner: str = Depends(require_key)):
    return {"sessions": await asyncio.to_thread(db_sessions, owner)}


@app.get("/api/export")
async def export_events(owner: str = Depends(require_key), fmt: str = "jsonl"):
    events, _ = await asyncio.to_thread(db_query_events, owner, 100_000, 0)
    if fmt == "csv":
        lines = ["id,timestamp,session_id,tool,category,summary,flagged,hostname,working_dir"]
        for e in reversed(events):
            s = (e.get("summary") or "").replace('"', '""')
            lines.append(
                f'{e["id"]},{e["timestamp"]},{e["session_id"]},{e["tool"]},{e["category"]},'
                f'"{s}",{e["flagged"]},{e.get("hostname","")},{e.get("working_dir","")}'
            )
        return Response(
            content="\n".join(lines), media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=claude_events.csv"},
        )
    lines = [json.dumps(e) for e in reversed(events)]
    return Response(
        content="\n".join(lines), media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=claude_events.jsonl"},
    )


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket, x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        await ws.close(code=4001)
        return
    await manager.connect(ws, x_api_key)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws, x_api_key)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8765, reload=True)
