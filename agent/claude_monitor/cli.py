"""
claude-monitor  —  CLI entry point

Commands:
  setup   --server-url URL --key KEY   configure and register the hook
  hook                                 run as Claude Code PreToolUse hook (stdin → server)
  view    [-n N] [-f] [-c CAT]         pretty-print the fallback log
  status                               show current config
"""
import argparse
import sys


def main():
    parser = argparse.ArgumentParser(
        prog="claude-monitor",
        description="Claude Code monitoring agent",
    )
    sub = parser.add_subparsers(dest="cmd", metavar="<command>")

    # setup
    p_setup = sub.add_parser("setup", help="Configure the agent and register the hook")
    p_setup.add_argument("--server-url", required=True, metavar="URL",
                         help="Hosted backend URL, e.g. https://monitor.example.com")
    p_setup.add_argument("--key", required=True, metavar="KEY",
                         help="Your API key (generate one: python -c \"import uuid;print(uuid.uuid4())\")")

    # hook (called by Claude Code, not by users directly)
    sub.add_parser("hook", help=argparse.SUPPRESS)

    # view
    p_view = sub.add_parser("view", help="View the fallback log (when server is unreachable)")
    p_view.add_argument("-n", "--num",      type=int, default=50)
    p_view.add_argument("-f", "--flagged",  action="store_true")
    p_view.add_argument("-c", "--category", default="")

    # status
    sub.add_parser("status", help="Show current config")

    args = parser.parse_args()

    if args.cmd == "setup":
        from .setup import run
        run(args.server_url, args.key)

    elif args.cmd == "hook":
        from .hook import main as hook_main
        hook_main()

    elif args.cmd == "view":
        from .viewer import main as viewer_main
        # pass args through sys.argv so viewer's own argparse picks them up
        sys.argv = [sys.argv[0]] + sys.argv[2:]
        viewer_main()

    elif args.cmd == "status":
        from .config import load, CONFIG_PATH
        cfg = load()
        if not cfg:
            print(f"No config found at {CONFIG_PATH}")
            print("Run: claude-monitor setup --server-url URL --key KEY")
        else:
            key = cfg.get("api_key", "")
            print(f"Config : {CONFIG_PATH}")
            print(f"Server : {cfg.get('server_url', '(not set)')}")
            print(f"Key    : {key[:8]}{'*' * max(0, len(key)-8)}")

    else:
        parser.print_help()
