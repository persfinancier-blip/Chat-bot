#!/usr/bin/env python
from __future__ import annotations

import argparse
import asyncio
import getpass
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
VENDOR_DIR = PROJECT_ROOT / "vendor"
if VENDOR_DIR.is_dir() and str(VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(VENDOR_DIR))

from chat_bot.telegram_sender import (
    _get_session_base_path,
    _get_telegram_client,
    load_telegram_config,
    validate_sender_alias,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Create or verify a Telethon sender session.")
    parser.add_argument("--sender-alias", required=True)
    parser.add_argument("--phone", required=True)
    return parser


async def login(sender_alias: str, phone: str) -> None:
    config = load_telegram_config()
    alias = validate_sender_alias(sender_alias)
    config.sessions_dir.mkdir(parents=True, exist_ok=True)

    client = _get_telegram_client(_get_session_base_path(alias, config), config.api_id, config.api_hash)

    await client.connect()
    try:
        if await client.is_user_authorized():
            print(f"SESSION_ALREADY_AUTHORIZED {alias}")
            return

        await client.send_code_request(phone)
        code = input("Telegram code: ").strip()

        try:
            await client.sign_in(phone=phone, code=code)
        except Exception as exc:
            from telethon.errors import SessionPasswordNeededError

            if not isinstance(exc, SessionPasswordNeededError):
                raise
            password = getpass.getpass("Telegram 2FA password: ")
            await client.sign_in(password=password)

        if not await client.is_user_authorized():
            raise RuntimeError(f"Telegram session is not authorized for sender_alias: {alias}")
    finally:
        await client.disconnect()

    print(f"SESSION_OK {alias}")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        asyncio.run(login(args.sender_alias, args.phone))
    except (RuntimeError, ValueError) as exc:
        parser.exit(1, f"ERROR: {exc}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
