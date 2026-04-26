import json
import unittest

from chat_bot.google_sheet_manager import (
    CONFIG_SHEET,
    DEFAULT_STRUCTURE,
    MAILING_SHEET,
    METRICS_SHEET,
    normalize_matrix,
    parse_delimited_row,
    parse_values_json,
    quote_sheet_name,
    sheet_range,
)


class GoogleSheetManagerHelpersTest(unittest.TestCase):
    def test_quote_sheet_name_escapes_single_quote(self):
        self.assertEqual(quote_sheet_name("A'B"), "'A''B'")

    def test_sheet_range_quotes_russian_title(self):
        self.assertEqual(sheet_range("Конфигурация", "A1:D1"), "'Конфигурация'!A1:D1")

    def test_parse_json_row_as_matrix(self):
        self.assertEqual(parse_values_json('["a", "b"]'), [["a", "b"]])

    def test_parse_json_matrix(self):
        self.assertEqual(parse_values_json('[["a"], ["b"]]'), [["a"], ["b"]])

    def test_normalize_rejects_mixed_lists(self):
        with self.assertRaises(ValueError):
            normalize_matrix(["a", ["b"]])

    def test_parse_delimited_row_trims_values(self):
        self.assertEqual(parse_delimited_row(" 1 | two | три "), ["1", "two", "три"])

    def test_config_header_contains_required_columns(self):
        self.assertEqual(
            DEFAULT_STRUCTURE[CONFIG_SHEET],
            ["key", "value", "comment"],
        )

    def test_mailing_header_matches_control_sheet_contract(self):
        self.assertEqual(
            DEFAULT_STRUCTURE[MAILING_SHEET],
            [
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
        )

    def test_metrics_header_matches_control_sheet_contract(self):
        self.assertEqual(
            DEFAULT_STRUCTURE[METRICS_SHEET],
            ["shop_id", "metric_date", "revenue", "drr", "avg_check", "orders", "spend", "comment"],
        )


if __name__ == "__main__":
    unittest.main()
