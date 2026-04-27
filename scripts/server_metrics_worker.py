#!/usr/bin/env python
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
VENDOR_DIR = PROJECT_ROOT / "vendor"
if VENDOR_DIR.is_dir() and str(VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(VENDOR_DIR))

from chat_bot.google_sheet_manager import DEFAULT_SPREADSHEET_ID, GoogleSheetManager
from chat_bot.runtime_modes import require_server_metrics_mode
from chat_bot.sheet_queue import SheetQueue, utc_timestamp


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Server metrics-only runner.")
    parser.add_argument("--spreadsheet-id", default=os.getenv("CHAT_BOT_SPREADSHEET_ID", DEFAULT_SPREADSHEET_ID))
    parser.add_argument("--check-only", action="store_true", help="Verify metrics-only mode without Sheet writes.")
    parser.add_argument("--create-test-task", action="store_true", help="Append one pending test task to Рассылка.")
    parser.add_argument("--sending-id", default=os.getenv("METRICS_SENDING_ID", ""))
    parser.add_argument("--shop-id", default=os.getenv("METRICS_SHOP_ID", "12345"))
    parser.add_argument("--sender-alias", default=os.getenv("METRICS_SENDER_ALIAS", "seller_main"))
    parser.add_argument("--recipient-contact", default=os.getenv("METRICS_RECIPIENT_CONTACT", ""))
    parser.add_argument("--mailing-variant", default=os.getenv("METRICS_MAILING_VARIANT", "daily_revenue_report"))
    parser.add_argument("--message-text", default=os.getenv("METRICS_MESSAGE_TEXT", ""))
    parser.add_argument("--dry-run", default=os.getenv("METRICS_DRY_RUN", "FALSE"))
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        require_server_metrics_mode()
    except RuntimeError as exc:
        parser.exit(1, f"ERROR: {exc}\n")

    if args.check_only:
        print("SERVER_METRICS_READY")
        print("telegram_runtime=disabled")
        return 0

    if not args.create_test_task:
        print("SERVER_METRICS_NOOP")
        print("Set --create-test-task or plug in real metrics collection.")
        return 0

    if not args.recipient_contact:
        parser.exit(1, "ERROR: --recipient-contact or METRICS_RECIPIENT_CONTACT is required\n")

    sending_id = args.sending_id or f"SND-{utc_timestamp().replace('-', '').replace(':', '').replace(' ', '-')}"
    manager = GoogleSheetManager(spreadsheet_id=args.spreadsheet_id)
    queue = SheetQueue(manager)
    queue.create_pending_task(
        sending_id=sending_id,
        shop_id=args.shop_id,
        sender_alias=args.sender_alias,
        recipient_contact=args.recipient_contact,
        mailing_variant=args.mailing_variant,
        message_text=args.message_text,
        dry_run=args.dry_run,
        comment="server metrics",
    )
    print(f"PENDING_TASK_READY {sending_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
