"""Writes hook config and wires the PreToolUse hook into Claude Code settings."""
import json
import sys
from pathlib import Path

from .config import save as save_config

CLAUDE_SETTINGS = Path.home() / ".claude" / "settings.json"


def run(server_url: str, api_key: str):
    # 1 — save agent config
    save_config({
        "server_url": server_url,
        "api_key":    api_key,
        "timeout":    3,
        "sensitive_patterns": [
            r"\.env", "id_rsa", r"\.ssh", "credentials",
            "token", "password", r"\.aws", r"\.pem",
        ],
    })

    # 2 — find the claude-monitor executable path
    hook_cmd = _hook_command()

    # 3 — patch ~/.claude/settings.json
    settings = {}
    if CLAUDE_SETTINGS.exists():
        with open(CLAUDE_SETTINGS) as f:
            settings = json.load(f)

    hooks = settings.setdefault("hooks", {})
    pre   = hooks.setdefault("PreToolUse", [])

    # remove any existing claude-monitor hook entry
    pre[:] = [h for h in pre if "claude-monitor" not in str(h)]

    pre.append({
        "matcher": ".*",
        "hooks":   [{"type": "command", "command": hook_cmd}],
    })

    CLAUDE_SETTINGS.parent.mkdir(parents=True, exist_ok=True)
    with open(CLAUDE_SETTINGS, "w") as f:
        json.dump(settings, f, indent=2)

    print(f"Hook registered in {CLAUDE_SETTINGS}")
    print(f"Server : {server_url}")
    print(f"Key    : {api_key[:8]}{'*' * (len(api_key) - 8)}")
    print("Restart Claude Code for the hook to take effect.")


def _hook_command() -> str:
    """Return the shell command Claude Code will run for the hook."""
    import shutil
    # Prefer the installed `claude-monitor hook` script
    cmd = shutil.which("claude-monitor")
    if cmd:
        return f"{cmd} hook"
    # Fall back to running the module directly
    return f"{sys.executable} -m claude_monitor.hook"
