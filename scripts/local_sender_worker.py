#!/usr/bin/env python
from __future__ import annotations

import argparse
import logging
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
from chat_bot.runtime_modes import require_local_sender_mode
from chat_bot.sheet_queue import SheetQueue, build_default_message_text
from chat_bot.telegram_sender import send_telegram_message_with_retries


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Process pending Telegram send jobs from Google Sheet.")
    parser.add_argument("--spreadsheet-id", default=os.getenv("CHAT_BOT_SPREADSHEET_ID", DEFAULT_SPREADSHEET_ID))
    parser.add_argument("--sender-alias", default=os.getenv("DEFAULT_SENDER_ALIAS", "seller_main"))
    parser.add_argument("--max-messages", type=int, default=int(os.getenv("MAX_MESSAGES_PER_RUN", "5")))
    parser.add_argument("--max-attempts", type=int, default=int(os.getenv("MAX_SEND_ATTEMPTS", "3")))
    parser.add_argument("--telegram-retries", type=int, default=int(os.getenv("TELEGRAM_SEND_RETRIES", "3")))
    parser.add_argument("--telegram-backoff-sec", type=float, default=float(os.getenv("TELEGRAM_RETRY_BACKOFF_SEC", "2")))
    return parser


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )


def process_once(args: argparse.Namespace) -> int:
    require_local_sender_mode()

    manager = GoogleSheetManager(spreadsheet_id=args.spreadsheet_id)
    queue = SheetQueue(manager)
    processed = 0

    for _ in range(max(1, args.max_messages)):
        task = queue.claim_next_pending(
            sender_alias=args.sender_alias,
            max_attempts=args.max_attempts,
        )
        if not task:
            logging.info("NO_PENDING_TASKS")
            break

        message_text = task.values.get("message_text", "").strip() or build_default_message_text(task)
        logging.info("PROCESSING sending_id=%s recipient=%s dry_run=%s", task.sending_id, task.recipient_contact, task.dry_run)

        try:
            if task.dry_run:
                telegram_message_id = "dry-run"
            else:
                result = send_telegram_message_with_retries(
                    task.sender_alias,
                    task.recipient_contact,
                    message_text,
                    retries=args.telegram_retries,
                    backoff_sec=args.telegram_backoff_sec,
                )
                telegram_message_id = str(result.get("telegram_message_id", ""))

            queue.mark_sent(task, telegram_message_id, message_text)
            logging.info("SENT sending_id=%s telegram_message_id=%s", task.sending_id, telegram_message_id)
            processed += 1
        except Exception as exc:
            error_text = f"{type(exc).__name__}: {exc}"
            queue.mark_failed(task, error_text, message_text)
            logging.error("FAILED sending_id=%s error=%s", task.sending_id, error_text[:500])
            processed += 1

    return 0 if processed >= 0 else 1


def main(argv: list[str] | None = None) -> int:
    configure_logging()
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return process_once(args)
    except Exception as exc:
        logging.error("LOCAL_SENDER_FATAL %s: %s", type(exc).__name__, exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
