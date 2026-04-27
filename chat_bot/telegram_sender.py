from __future__ import annotations

import asyncio
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from chat_bot.runtime_modes import require_local_sender_mode


SENDER_ALIAS_RE = re.compile(r"^[A-Za-z0-9_-]+$")


@dataclass(frozen=True)
class TelegramConfig:
    api_id: int
    api_hash: str
    sessions_dir: Path
    proxy: tuple[Any, ...] | None = None


def load_telegram_config() -> TelegramConfig:
    require_local_sender_mode()

    api_id_raw = os.getenv("TELEGRAM_API_ID")
    api_hash = os.getenv("TELEGRAM_API_HASH")
    sessions_dir = Path(os.getenv("TELEGRAM_SESSIONS_DIR", "./sessions")).expanduser()
    proxy = _load_proxy_config()

    if not api_id_raw:
        raise RuntimeError("TELEGRAM_API_ID is required")
    if not api_hash:
        raise RuntimeError("TELEGRAM_API_HASH is required")

    try:
        api_id = int(api_id_raw)
    except ValueError as exc:
        raise RuntimeError("TELEGRAM_API_ID must be an integer") from exc

    return TelegramConfig(api_id=api_id, api_hash=api_hash, sessions_dir=sessions_dir, proxy=proxy)


def _load_proxy_config() -> tuple[Any, ...] | None:
    proxy_type = os.getenv("TG_PROXY_TYPE")
    proxy_host = os.getenv("TG_PROXY_HOST")
    proxy_port = os.getenv("TG_PROXY_PORT")
    proxy_user = os.getenv("TG_PROXY_USER")
    proxy_pass = os.getenv("TG_PROXY_PASS")

    if not any([proxy_type, proxy_host, proxy_port, proxy_user, proxy_pass]):
        return None

    if (proxy_type or "").lower() != "socks5":
        raise RuntimeError("TG_PROXY_TYPE must be socks5")
    if not proxy_host:
        raise RuntimeError("TG_PROXY_HOST is required when TG_PROXY_TYPE is set")
    if not proxy_port:
        raise RuntimeError("TG_PROXY_PORT is required when TG_PROXY_TYPE is set")

    try:
        port = int(proxy_port)
    except ValueError as exc:
        raise RuntimeError("TG_PROXY_PORT must be an integer") from exc

    try:
        import socks
    except ImportError as exc:
        raise RuntimeError("PySocks is required for TG_PROXY_TYPE=socks5") from exc

    try:
        import python_socks  # noqa: F401
    except ImportError as exc:
        raise RuntimeError("python-socks[asyncio] is required for TG_PROXY_TYPE=socks5") from exc

    if proxy_user or proxy_pass:
        return (socks.SOCKS5, proxy_host, port, True, proxy_user, proxy_pass)
    return (socks.SOCKS5, proxy_host, port)


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


def _get_telegram_client(
    session_base_path: Path,
    api_id: int,
    api_hash: str,
    proxy: tuple[Any, ...] | None = None,
) -> Any:
    from telethon import TelegramClient

    return TelegramClient(str(session_base_path), api_id, api_hash, proxy=proxy)


async def _send_telegram_message_async(
    sender_alias: str,
    recipient_contact: str,
    message_text: str,
) -> dict[str, Any]:
    config = load_telegram_config()
    session_file = get_session_path(sender_alias)

    if not session_file.exists():
        raise FileNotFoundError(f"Telegram session not found for sender_alias: {sender_alias}")

    client = _get_telegram_client(
        _get_session_base_path(sender_alias, config),
        config.api_id,
        config.api_hash,
        config.proxy,
    )

    await client.connect()
    try:
        if not await client.is_user_authorized():
            raise RuntimeError(f"Telegram session is not authorized for sender_alias: {sender_alias}")

        target = "me" if recipient_contact == "me" else recipient_contact
        message = await client.send_message(target, message_text)
    finally:
        await client.disconnect()

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


def send_telegram_message_with_retries(
    sender_alias: str,
    recipient_contact: str,
    message_text: str,
    retries: int = 3,
    backoff_sec: float = 2.0,
) -> dict[str, Any]:
    last_error: Exception | None = None
    attempts = max(1, retries)
    for attempt in range(1, attempts + 1):
        try:
            return send_telegram_message(sender_alias, recipient_contact, message_text)
        except Exception as exc:
            last_error = exc
            if attempt >= attempts:
                break
            time.sleep(backoff_sec * attempt)

    assert last_error is not None
    raise last_error
