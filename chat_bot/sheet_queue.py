from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from chat_bot.google_sheet_manager import MAILING_SHEET, SEND_LOG_SHEET, GoogleSheetManager, sheet_range


STATUS_PENDING = "pending"
STATUS_PROCESSING = "processing"
STATUS_SENT = "sent"
STATUS_FAILED = "failed"

MAILING_COLUMNS = [
    "sending_id",
    "shop_id",
    "sender_alias",
    "recipient_id",
    "recipient_contact",
    "mailing_variant",
    "send_at",
    "timezone",
    "status",
    "dry_run",
    "message_text",
    "last_error",
    "sent_at",
    "telegram_message_id",
    "attempts",
    "comment",
]

SEND_LOG_COLUMNS = [
    "log_id",
    "sending_id",
    "status",
    "sender_alias",
    "recipient_contact",
    "message_text",
    "error_text",
    "telegram_message_id",
    "created_at",
    "comment",
]


@dataclass(frozen=True)
class MailingTask:
    row_number: int
    values: dict[str, str]
    attempts: int

    @property
    def sending_id(self) -> str:
        return self.values.get("sending_id", "")

    @property
    def shop_id(self) -> str:
        return self.values.get("shop_id", "")

    @property
    def sender_alias(self) -> str:
        return self.values.get("sender_alias", "")

    @property
    def recipient_contact(self) -> str:
        return self.values.get("recipient_contact", "")

    @property
    def mailing_variant(self) -> str:
        return self.values.get("mailing_variant", "")

    @property
    def dry_run(self) -> bool:
        return self.values.get("dry_run", "").strip().upper() == "TRUE"


def utc_timestamp() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")


def parse_attempts(raw: str) -> int:
    try:
        return int(raw or "0")
    except ValueError:
        return 0


def row_to_dict(header: list[str], row: list[Any]) -> dict[str, str]:
    padded = [str(value) for value in row] + [""] * max(0, len(header) - len(row))
    return dict(zip(header, padded[: len(header)]))


def build_default_message_text(task: MailingTask) -> str:
    return (
        "Тестовое сообщение Chat_Bot.\n"
        f"sending_id: {task.sending_id}\n"
        f"shop_id: {task.shop_id}\n"
        f"variant: {task.mailing_variant}"
    )


class SheetQueue:
    def __init__(self, manager: GoogleSheetManager):
        self.manager = manager

    def read_mailing_rows(self, max_rows: int = 200) -> list[tuple[int, dict[str, str]]]:
        values = self.manager.get_values(sheet_range(MAILING_SHEET, f"A1:P{max_rows}"))
        if not values:
            return []

        header = [str(item) for item in values[0]]
        if header[: len(MAILING_COLUMNS)] != MAILING_COLUMNS:
            raise RuntimeError("Рассылка sheet header does not match the queue contract")

        rows: list[tuple[int, dict[str, str]]] = []
        for offset, row in enumerate(values[1:], start=2):
            rows.append((offset, row_to_dict(MAILING_COLUMNS, row)))
        return rows

    def claim_next_pending(
        self,
        sender_alias: str,
        max_rows: int = 200,
        max_attempts: int = 3,
    ) -> MailingTask | None:
        for row_number, row in self.read_mailing_rows(max_rows=max_rows):
            status = row.get("status", "").strip().lower()
            row_sender = row.get("sender_alias", "").strip() or sender_alias
            recipient_contact = row.get("recipient_contact", "").strip()
            attempts = parse_attempts(row.get("attempts", "0"))

            if status != STATUS_PENDING:
                continue
            if not recipient_contact:
                continue
            if row_sender != sender_alias:
                continue
            if attempts >= max_attempts:
                self.mark_failed(
                    MailingTask(row_number=row_number, values=row, attempts=attempts),
                    f"Max attempts reached: {attempts}",
                )
                continue

            claimed_attempts = attempts + 1
            row["sender_alias"] = row_sender
            row["status"] = STATUS_PROCESSING
            row["last_error"] = ""
            row["sent_at"] = ""
            row["telegram_message_id"] = ""
            row["attempts"] = str(claimed_attempts)

            self.manager.update_values(
                sheet_range(MAILING_SHEET, f"C{row_number}:O{row_number}"),
                [[
                    row_sender,
                    row.get("recipient_id", ""),
                    row.get("recipient_contact", ""),
                    row.get("mailing_variant", ""),
                    row.get("send_at", ""),
                    row.get("timezone", ""),
                    STATUS_PROCESSING,
                    row.get("dry_run", ""),
                    row.get("message_text", ""),
                    "",
                    "",
                    "",
                    claimed_attempts,
                ]],
            )

            fresh = self._read_mailing_row(row_number)
            if fresh.get("status", "").strip().lower() != STATUS_PROCESSING:
                continue
            if parse_attempts(fresh.get("attempts", "0")) != claimed_attempts:
                continue
            return MailingTask(row_number=row_number, values=fresh, attempts=claimed_attempts)

        return None

    def _read_mailing_row(self, row_number: int) -> dict[str, str]:
        values = self.manager.get_values(sheet_range(MAILING_SHEET, f"A{row_number}:P{row_number}"))
        row = values[0] if values else []
        return row_to_dict(MAILING_COLUMNS, row)

    def mark_sent(self, task: MailingTask, telegram_message_id: str, message_text: str) -> None:
        timestamp = utc_timestamp()
        self.manager.update_values(
            sheet_range(MAILING_SHEET, f"I{task.row_number}:O{task.row_number}"),
            [[
                STATUS_SENT,
                task.values.get("dry_run", ""),
                message_text,
                "",
                timestamp,
                telegram_message_id,
                task.attempts,
            ]],
        )
        self.append_log(task, STATUS_SENT, message_text, "", telegram_message_id, "local sender")

    def mark_failed(self, task: MailingTask, error_text: str, message_text: str | None = None) -> None:
        clipped_error = error_text[:1000]
        self.manager.update_values(
            sheet_range(MAILING_SHEET, f"I{task.row_number}:O{task.row_number}"),
            [[
                STATUS_FAILED,
                task.values.get("dry_run", ""),
                message_text if message_text is not None else task.values.get("message_text", ""),
                clipped_error,
                "",
                "",
                task.attempts,
            ]],
        )
        self.append_log(task, STATUS_FAILED, message_text or task.values.get("message_text", ""), clipped_error, "", "local sender")

    def append_log(
        self,
        task: MailingTask,
        status: str,
        message_text: str,
        error_text: str,
        telegram_message_id: str,
        comment: str,
    ) -> None:
        created_at = utc_timestamp()
        log_id = f"LOG-{created_at.replace('-', '').replace(':', '').replace(' ', '-')}-{task.sending_id}"
        self.manager.append_rows(
            SEND_LOG_SHEET,
            [[
                log_id,
                task.sending_id,
                status,
                task.sender_alias,
                task.recipient_contact,
                message_text,
                error_text,
                telegram_message_id,
                created_at,
                comment,
            ]],
        )

    def create_pending_task(
        self,
        sending_id: str,
        shop_id: str,
        sender_alias: str,
        recipient_contact: str,
        mailing_variant: str,
        message_text: str = "",
        recipient_id: str = "",
        send_at: str = "",
        timezone: str = "Europe/Moscow",
        dry_run: str = "FALSE",
        comment: str = "server metrics",
    ) -> str:
        if self._sending_id_exists(sending_id):
            return sending_id

        self.manager.append_rows(
            MAILING_SHEET,
            [[
                sending_id,
                shop_id,
                sender_alias,
                recipient_id,
                recipient_contact,
                mailing_variant,
                send_at,
                timezone,
                STATUS_PENDING,
                dry_run,
                message_text,
                "",
                "",
                "",
                0,
                comment,
            ]],
        )
        return sending_id

    def _sending_id_exists(self, sending_id: str) -> bool:
        for _, row in self.read_mailing_rows(max_rows=500):
            if row.get("sending_id") == sending_id:
                return True
        return False
