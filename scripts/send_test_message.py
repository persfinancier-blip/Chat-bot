#!/usr/bin/env python
from __future__ import annotations

import argparse
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
VENDOR_DIR = PROJECT_ROOT / "vendor"
if VENDOR_DIR.is_dir() and str(VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(VENDOR_DIR))

from chat_bot.telegram_sender import send_telegram_message


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Send a test Telegram message through a sender session.")
    parser.add_argument("--sender-alias", required=True)
    parser.add_argument("--to", required=True)
    parser.add_argument("--message", required=True)
    parser.add_argument("--allow-external", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.to != "me" and not args.allow_external:
        parser.exit(1, "ERROR: external recipients require --allow-external\n")

    try:
        result = send_telegram_message(args.sender_alias, args.to, args.message)
    except Exception as exc:
        parser.exit(1, f"ERROR: {exc}\n")

    print("MESSAGE_SENT")
    print(f"sender_alias={result['sender_alias']}")
    print(f"recipient_contact={result['recipient_contact']}")
    print(f"telegram_message_id={result['telegram_message_id']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
