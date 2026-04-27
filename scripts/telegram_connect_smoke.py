#!/usr/bin/env python
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
VENDOR_DIR = PROJECT_ROOT / "vendor"
if VENDOR_DIR.is_dir() and str(VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(VENDOR_DIR))

from chat_bot.telegram_sender import _get_telegram_client, load_telegram_config


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Smoke-test a Telethon connection.")
    parser.add_argument("--timeout-sec", type=float, default=20.0)
    return parser


async def connect_once(timeout_sec: float) -> None:
    config = load_telegram_config()
    config.sessions_dir.mkdir(parents=True, exist_ok=True)
    session_base_path = config.sessions_dir / "connect_smoke"
    client = _get_telegram_client(session_base_path, config.api_id, config.api_hash, config.proxy)

    try:
        await asyncio.wait_for(client.connect(), timeout=timeout_sec)
        connected = client.is_connected()
    finally:
        await client.disconnect()

    if not connected:
        raise RuntimeError("Telethon client did not report connected=True")

    print("CONNECT_OK")
    print(f"proxy_enabled={bool(config.proxy)}")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        asyncio.run(connect_once(args.timeout_sec))
    except Exception as exc:
        parser.exit(1, f"CONNECT_FAIL {type(exc).__name__}: {exc}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
