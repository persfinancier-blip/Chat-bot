from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Iterable


DEFAULT_SPREADSHEET_ID = "1OdgpoZiwyAkwnOxRtgr5bFx8WyN2RbO83Fwjss0pUrg"
SCOPES = ("https://www.googleapis.com/auth/spreadsheets",)

DESCRIPTION_SHEET = "Описание"
CONFIG_SHEET = "Конфигурация"
SENDERS_SHEET = "Отправители"
RECIPIENTS_SHEET = "Получатели"
TEMPLATES_SHEET = "Шаблоны"
MAILING_SHEET = "Рассылка"
METRICS_SHEET = "Метрики"
SEND_LOG_SHEET = "Лог отправок"

DEFAULT_STRUCTURE = {
    DESCRIPTION_SHEET: ["Раздел", "Описание"],
    CONFIG_SHEET: ["key", "value", "comment"],
    SENDERS_SHEET: ["sender_alias", "display_name", "session_ref", "is_active", "comment", "updated_at"],
    RECIPIENTS_SHEET: [
        "recipient_id",
        "client_name",
        "shop_id",
        "recipient_contact",
        "telegram_chat_id",
        "is_active",
        "comment",
        "updated_at",
    ],
    TEMPLATES_SHEET: [
        "mailing_variant",
        "title",
        "template_text",
        "metrics_source",
        "is_active",
        "comment",
        "updated_at",
    ],
    MAILING_SHEET: [
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
    ],
    METRICS_SHEET: [
        "shop_id",
        "metric_date",
        "revenue",
        "drr",
        "avg_check",
        "orders",
        "spend",
        "comment",
    ],
    SEND_LOG_SHEET: [
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
    ],
}

DEFAULT_DESCRIPTION_ROWS = [
    ["Назначение", "Панель управления чат-ботом рассылок"],
    ["Конфигурация", "Глобальные настройки работы бота"],
    ["Отправители", "Алиасы Telegram-сессий отправителей"],
    ["Получатели", "Клиенты/получатели сообщений"],
    ["Шаблоны", "Варианты рассылок и шаблоны текста"],
    ["Рассылка", "Очередь заданий на отправку"],
    ["Метрики", "Табличные данные для формирования сообщений"],
    ["Лог отправок", "История попыток отправки и ошибок"],
    ["status=ready", "Строка готова к обработке"],
    ["status=draft", "Черновик, бот не трогает"],
    ["dry_run=TRUE", "Тестовый режим без реальной отправки"],
    ["dry_run=FALSE", "Реальная отправка"],
]


def quote_sheet_name(title: str) -> str:
    return "'" + title.replace("'", "''") + "'"


def sheet_range(title: str, range_part: str) -> str:
    return f"{quote_sheet_name(title)}!{range_part}"


def normalize_matrix(values: Any) -> list[list[Any]]:
    if not isinstance(values, list):
        raise ValueError("values must be a JSON list")
    if not values:
        return []
    if all(not isinstance(item, list) for item in values):
        return [values]
    if all(isinstance(item, list) for item in values):
        return values
    raise ValueError("values must be a row list or a matrix list")


def parse_values_json(raw: str) -> list[list[Any]]:
    return normalize_matrix(json.loads(raw))


def parse_delimited_row(raw: str, delimiter: str = "|") -> list[str]:
    return [part.strip() for part in raw.split(delimiter)]


def load_credentials_from_env() -> Any:
    credentials_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    credentials_file = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE")

    if credentials_json:
        from google.oauth2 import service_account

        info = json.loads(credentials_json)
        return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)

    if credentials_file:
        from google.oauth2 import service_account

        return service_account.Credentials.from_service_account_file(credentials_file, scopes=SCOPES)

    raise RuntimeError(
        "Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE before using Google Sheets."
    )


def build_sheets_service() -> Any:
    credentials = load_credentials_from_env()

    from googleapiclient.discovery import build

    return build("sheets", "v4", credentials=credentials)


@dataclass
class SheetInfo:
    title: str
    sheet_id: int
    index: int


class GoogleSheetManager:
    def __init__(self, spreadsheet_id: str = DEFAULT_SPREADSHEET_ID, service: Any | None = None):
        self.spreadsheet_id = spreadsheet_id
        self.service = service or build_sheets_service()

    def list_sheets(self) -> list[SheetInfo]:
        result = (
            self.service.spreadsheets()
            .get(
                spreadsheetId=self.spreadsheet_id,
                fields="sheets(properties(sheetId,title,index))",
            )
            .execute()
        )
        sheets = []
        for item in result.get("sheets", []):
            props = item["properties"]
            sheets.append(
                SheetInfo(
                    title=props["title"],
                    sheet_id=int(props["sheetId"]),
                    index=int(props.get("index", 0)),
                )
            )
        return sheets

    def sheet_map(self) -> dict[str, SheetInfo]:
        return {sheet.title: sheet for sheet in self.list_sheets()}

    def add_sheet(self, title: str, index: int | None = None) -> int:
        properties: dict[str, Any] = {"title": title}
        if index is not None:
            properties["index"] = index
        result = self._batch_update(
            [{"addSheet": {"properties": properties}}],
            response_ranges=False,
        )
        return int(result["replies"][0]["addSheet"]["properties"]["sheetId"])

    def ensure_sheet(self, title: str, index: int | None = None) -> int:
        existing = self.sheet_map().get(title)
        if existing:
            return existing.sheet_id
        return self.add_sheet(title, index=index)

    def delete_sheet(self, title: str) -> bool:
        existing = self.sheet_map().get(title)
        if not existing:
            return False
        self._batch_update([{"deleteSheet": {"sheetId": existing.sheet_id}}])
        return True

    def update_values(self, a1_range: str, values: list[list[Any]]) -> dict[str, Any]:
        return (
            self.service.spreadsheets()
            .values()
            .update(
                spreadsheetId=self.spreadsheet_id,
                range=a1_range,
                valueInputOption="USER_ENTERED",
                body={"values": values},
            )
            .execute()
        )

    def append_rows(self, sheet_title: str, rows: list[list[Any]]) -> dict[str, Any]:
        return (
            self.service.spreadsheets()
            .values()
            .append(
                spreadsheetId=self.spreadsheet_id,
                range=sheet_range(sheet_title, "A:Z"),
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": rows},
            )
            .execute()
        )

    def clear_range(self, a1_range: str) -> dict[str, Any]:
        return (
            self.service.spreadsheets()
            .values()
            .clear(
                spreadsheetId=self.spreadsheet_id,
                range=a1_range,
                body={},
            )
            .execute()
        )

    def set_cell(self, sheet_title: str, cell: str, value: Any) -> dict[str, Any]:
        return self.update_values(sheet_range(sheet_title, cell), [[value]])

    def init_structure(self, include_description_rows: bool = False) -> None:
        requests = []
        sheet_ids: dict[str, int] = {}
        for index, title in enumerate(DEFAULT_STRUCTURE):
            sheet_ids[title] = self.ensure_sheet(title, index=index)

        for title, headers in DEFAULT_STRUCTURE.items():
            self.update_values(sheet_range(title, "A1"), [headers])
            sheet_id = sheet_ids[title]
            requests.extend(
                [
                    {
                        "updateSheetProperties": {
                            "properties": {
                                "sheetId": sheet_id,
                                "gridProperties": {"frozenRowCount": 1},
                            },
                            "fields": "gridProperties.frozenRowCount",
                        }
                    },
                    {
                        "autoResizeDimensions": {
                            "dimensions": {
                                "sheetId": sheet_id,
                                "dimension": "COLUMNS",
                                "startIndex": 0,
                                "endIndex": len(headers),
                            }
                        }
                    },
                ]
            )

        if requests:
            self._batch_update(requests)

        if include_description_rows:
            self.append_rows(DESCRIPTION_SHEET, DEFAULT_DESCRIPTION_ROWS)

    def upsert_config_rows(self, rows: Iterable[dict[str, Any]]) -> None:
        header = DEFAULT_STRUCTURE[CONFIG_SHEET]
        matrix = [[row.get(column, "") for column in header] for row in rows]
        if matrix:
            self.append_rows(CONFIG_SHEET, matrix)

    def _batch_update(self, requests: list[dict[str, Any]], response_ranges: bool = True) -> dict[str, Any]:
        body: dict[str, Any] = {"requests": requests}
        if response_ranges:
            body["includeSpreadsheetInResponse"] = False
        return (
            self.service.spreadsheets()
            .batchUpdate(spreadsheetId=self.spreadsheet_id, body=body)
            .execute()
        )
