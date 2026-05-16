"""Reads agent config from ~/.claude/claude_monitor.json"""
import json
from pathlib import Path

CONFIG_PATH = Path.home() / ".claude" / "claude_monitor.json"


def load() -> dict:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {}


def save(data: dict):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Config saved to {CONFIG_PATH}")
