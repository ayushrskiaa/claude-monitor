#!/usr/bin/env python3
"""CLI viewer for the fallback log (used when the server is unreachable)."""
import argparse
import json
from datetime import datetime
from pathlib import Path

LOG = Path.home() / ".claude" / "claude_monitor_fallback.jsonl"

R="\033[0m"; BOLD="\033[1m"; RED="\033[91m"; YEL="\033[93m"
GRN="\033[92m"; CYN="\033[96m"; MAG="\033[95m"; BLU="\033[94m"; DIM="\033[2m"

CAT_COLOR = {
    "file_read": CYN, "file_write": YEL, "file_search": GRN,
    "command_exec": RED, "network": MAG, "agent_spawn": BLU,
}


def fmt_time(ts):
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).strftime("%H:%M:%S")
    except Exception:
        return ts[:8]


def main():
    p = argparse.ArgumentParser(description="View claude-monitor fallback log")
    p.add_argument("-n", "--num",      type=int, default=50)
    p.add_argument("-f", "--flagged",  action="store_true")
    p.add_argument("-c", "--category", default="")
    p.add_argument("--stats",          action="store_true")
    args = p.parse_args()

    if not LOG.exists():
        print(f"{YEL}No fallback log at {LOG}{R}")
        print("Events are written here only when the server is unreachable.")
        return

    entries = []
    with open(LOG, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    pass

    if args.flagged:
        entries = [e for e in entries if e.get("flagged")]
    if args.category:
        entries = [e for e in entries if args.category.lower() in e.get("category", "").lower()]

    if args.stats:
        cats = {}
        for e in entries:
            c = e.get("category", "unknown")
            cats[c] = cats.get(c, 0) + 1
        fc = sum(1 for e in entries if e.get("flagged"))
        print(f"\n{BOLD}Fallback log — {LOG}{R}")
        print(f"  Total: {len(entries)}   Flagged: {RED if fc else GRN}{fc}{R}")
        for cat, n in sorted(cats.items(), key=lambda x: -x[1]):
            col = CAT_COLOR.get(cat, DIM)
            print(f"  {col}{cat:<18}{R} {n:>4}  {col}{'|' * min(n, 40)}{R}")
        return

    shown = entries[-args.num:]
    print(f"\n{BOLD}Fallback log{R}  {DIM}(last {len(shown)} of {len(entries)}){R}")
    print(f"  {'TIME':<10}  {'TOOL':<14}  {'CATEGORY':<15}  SUMMARY")
    print("  " + "-" * 80)
    for e in shown:
        col  = CAT_COLOR.get(e.get("category"), DIM)
        flag = f"{RED}[FLAGGED]{R} " if e.get("flagged") else ""
        s    = e.get("summary", "")[:75]
        print(f"  {DIM}{fmt_time(e.get('timestamp', ''))}{R}  {BOLD}{col}{e.get('tool', ''):<14}{R}  {col}{e.get('category', ''):<15}{R}  {flag}{s}")
    print()


if __name__ == "__main__":
    main()
