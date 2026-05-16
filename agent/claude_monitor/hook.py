#!/usr/bin/env python3
"""
Claude Monitor Agent — Hook
Invoked by Claude Code on every tool call via PreToolUse hook.
Reads config from ~/.claude/claude_monitor.json
"""
import json
import re
import socket
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from .config import load as load_config

FALLBACK_LOG = Path.home() / ".claude" / "claude_monitor_fallback.jsonl"

TOOL_CATEGORIES = {
    "Read": "file_read", "Write": "file_write", "Edit": "file_write",
    "Bash": "command_exec", "PowerShell": "command_exec",
    "Glob": "file_search", "Grep": "file_search",
    "WebFetch": "network", "WebSearch": "network",
    "Agent": "agent_spawn",
    "TaskCreate": "task_write", "TaskUpdate": "task_write", "TaskStop": "task_write",
    "TaskGet": "task_read", "TaskList": "task_read", "TaskOutput": "task_read",
}


def classify(tool: str) -> str:
    return TOOL_CATEGORIES.get(tool, "unknown")


def summarise(tool: str, inp: dict) -> str:
    if tool in ("Read", "Write", "Edit"):
        return inp.get("file_path", "")
    if tool in ("Bash", "PowerShell"):
        cmd = inp.get("command", "")
        return cmd[:120] + ("..." if len(cmd) > 120 else "")
    if tool == "Glob":
        return inp.get("pattern", "")
    if tool == "Grep":
        return f"{inp.get('pattern', '')} in {inp.get('path', '.')}"
    if tool in ("WebFetch", "WebSearch"):
        return inp.get("url", inp.get("query", ""))
    if tool == "Agent":
        return inp.get("description", "")
    if tool == "TaskCreate":
        return inp.get("title", inp.get("description", ""))
    if tool in ("TaskGet", "TaskUpdate", "TaskStop", "TaskOutput"):
        return inp.get("task_id", "")
    return json.dumps(inp)[:120]


def is_sensitive(value: str, patterns: list[str]) -> bool:
    return any(re.search(p, value, re.IGNORECASE) for p in patterns)


def post(server_url: str, api_key: str, entry: dict, timeout: int) -> bool:
    try:
        body = json.dumps(entry).encode()
        req  = Request(
            server_url.rstrip("/") + "/events",
            data=body,
            headers={"Content-Type": "application/json", "X-Api-Key": api_key},
            method="POST",
        )
        with urlopen(req, timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False


def fallback_write(entry: dict):
    FALLBACK_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(FALLBACK_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def main():
    config      = load_config()
    server_url  = config.get("server_url", "")
    api_key     = config.get("api_key", "")
    timeout     = int(config.get("timeout", 3))
    sens_pats   = config.get("sensitive_patterns", [
        r"\.env", "id_rsa", r"\.ssh", "credentials", "token",
        "password", r"\.aws", r"\.pem",
    ])

    raw = sys.stdin.buffer.read().decode("utf-8-sig").strip()
    if not raw:
        sys.exit(0)
    try:
        event = json.loads(raw)
    except json.JSONDecodeError:
        sys.exit(0)

    tool       = event.get("tool_name", "Unknown")
    tool_input = event.get("tool_input", {})
    session_id = event.get("session_id", "unknown")

    paths   = [str(tool_input[k]) for k in ("file_path", "path", "directory") if tool_input.get(k)]
    flagged = any(is_sensitive(p, sens_pats) for p in paths)
    if tool in ("Bash", "PowerShell") and is_sensitive(tool_input.get("command", ""), sens_pats):
        flagged = True

    entry = {
        "timestamp":   datetime.now(timezone.utc).isoformat(),
        "session_id":  session_id,
        "tool":        tool,
        "category":    classify(tool),
        "summary":     summarise(tool, tool_input),
        "paths":       paths,
        "flagged":     flagged,
        "input":       tool_input,
        "hostname":    _hostname(),
        "working_dir": str(Path.cwd()),
    }

    if server_url and api_key:
        sent = post(server_url, api_key, entry, timeout)
    else:
        sent = False

    if not sent:
        fallback_write(entry)

    if flagged:
        print(f"[claude-monitor] SENSITIVE: {tool} -> {entry['summary']}", file=sys.stderr)

    sys.exit(0)


def _hostname() -> str:
    try:
        return socket.gethostname()
    except Exception:
        return ""


if __name__ == "__main__":
    main()
