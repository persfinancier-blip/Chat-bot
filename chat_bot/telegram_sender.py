from __future__ import annotations

import asyncio
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SENDER_ALIAS_RE = re.compile(r"^[A-Za-z0-9_-]+$")


@dataclass(frozen=True)
class TelegramConfig:
    api_id: int
    api_hash: str
    sessions_dir: Path


def load_telegram_config() -> TelegramConfig:
    api_id_raw = os.getenv("TELEGRAM_API_ID")
    api_hash = os.getenv("TELEGRAM_API_HASH")
    sessions_dir = Path(os.getenv("TELEGRAM_SESSIONS_DIR", "./sessions")).expanduser()

    if not api_id_raw:
        raise RuntimeError("TELEGRAM_API_ID is required")
    if not api_hash:
        raise RuntimeError("TELEGRAM_API_HASH is required")

    try:
        api_id = int(api_id_raw)
    except ValueError as exc:
        raise RuntimeError("TELEGRAM_API_ID must be an integer") from exc

    return TelegramConfig(api_id=api_id, api_hash=api_hash, sessions_dir=sessions_dir)


def validate_sender_alias(sender_alias: str) -> str:
    if not sender_alias or not SENDER_ALIAS_RE.fullmatch(sender_alias):
        raise ValueError("sender_alias may contain only A-Z, a-z, 0-9, _ and -")
    return sender_alias


def get_session_path(sender_alias: str) -> Path:
    config = load_telegram_config()
    alias = validate_sender_alias(sender_alias)
    return config.sessions_dir / f"{alias}.session"


def _get_session_base_path(sender_alias: str, config: TelegramConfig) -> Path:
    alias = validate_sender_alias(sender_alias)
    return config.sessions_dir / alias


def _get_telegram_client(session_base_path: Path, api_id: int, api_hash: str) -> Any:
    from telethon import TelegramClient

    return TelegramClient(str(session_base_path), api_id, api_hash)


async def _send_telegram_message_async(
    sender_alias: str,
    recipient_contact: str,
    message_text: str,
) -> dict[str, Any]:
    config = load_telegram_config()
    session_file = get_session_path(sender_alias)

    if not session_file.exists():
        raise FileNotFoundError(f"Telegram session not found for sender_alias: {sender_alias}")

    client = _get_telegram_client(_get_session_base_path(sender_alias, config), config.api_id, config.api_hash)

    async with client:
        if not await client.is_user_authorized():
            raise RuntimeError(f"Telegram session is not authorized for sender_alias: {sender_alias}")

        target = "me" if recipient_contact == "me" else recipient_contact
        message = await client.send_message(target, message_text)

    return {
        "status": "sent",
        "sender_alias": sender_alias,
        "recipient_contact": recipient_contact,
        "telegram_message_id": getattr(message, "id", None),
    }


def send_telegram_message(
    sender_alias: str,
    recipient_contact: str,
    message_text: str,
) -> dict[str, Any]:
    return asyncio.run(_send_telegram_message_async(sender_alias, recipient_contact, message_text))
