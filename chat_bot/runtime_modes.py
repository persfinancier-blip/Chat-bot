from __future__ import annotations

import os


SERVER_MODE_METRICS = "metrics"
LOCAL_MODE_SENDER = "sender"


def require_server_metrics_mode() -> None:
    if os.getenv("SERVER_MODE") != SERVER_MODE_METRICS:
        raise RuntimeError("SERVER_MODE=metrics is required for the server metrics runner")
    if os.getenv("LOCAL_MODE") == LOCAL_MODE_SENDER:
        raise RuntimeError("LOCAL_MODE=sender must not be set in SERVER_MODE=metrics")


def require_local_sender_mode() -> None:
    if os.getenv("LOCAL_MODE") != LOCAL_MODE_SENDER:
        raise RuntimeError("LOCAL_MODE=sender is required for Telegram sender runtime")
    if os.getenv("SERVER_MODE") == SERVER_MODE_METRICS:
        raise RuntimeError("SERVER_MODE=metrics must not be set in LOCAL_MODE=sender")
