import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from chat_bot import telegram_sender


class FakeTelegramClient:
    async def connect(self):
        self.connected = True

    async def disconnect(self):
        self.disconnected = True

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def is_user_authorized(self):
        return True

    async def send_message(self, target, message):
        self.target = target
        self.message = message
        return SimpleNamespace(id=12345)


class TelegramSenderTest(unittest.TestCase):
    def test_missing_api_id_raises(self):
        with mock.patch.dict(os.environ, {"TELEGRAM_API_HASH": "hash"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "TELEGRAM_API_ID is required"):
                telegram_sender.load_telegram_config()

    def test_missing_api_hash_raises(self):
        with mock.patch.dict(os.environ, {"TELEGRAM_API_ID": "123"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "TELEGRAM_API_HASH is required"):
                telegram_sender.load_telegram_config()

    def test_get_session_path_uses_alias_session_filename(self):
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.dict(
                os.environ,
                {
                    "TELEGRAM_API_ID": "123",
                    "TELEGRAM_API_HASH": "hash",
                    "TELEGRAM_SESSIONS_DIR": tmp,
                },
                clear=True,
            ):
                self.assertEqual(
                    telegram_sender.get_session_path("seller_main"),
                    Path(tmp) / "seller_main.session",
                )

    def test_bad_sender_alias_rejected(self):
        with self.assertRaises(ValueError):
            telegram_sender.validate_sender_alias("../seller_main")

    def test_session_files_are_gitignored(self):
        gitignore = Path(".gitignore").read_text(encoding="utf-8")
        self.assertIn("sessions/", gitignore)
        self.assertIn("*.session", gitignore)
        self.assertIn("*.session-journal", gitignore)

    def test_send_telegram_message_can_be_mocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "seller_main.session").write_text("", encoding="utf-8")
            with mock.patch.dict(
                os.environ,
                {
                    "TELEGRAM_API_ID": "123",
                    "TELEGRAM_API_HASH": "hash",
                    "TELEGRAM_SESSIONS_DIR": tmp,
                },
                clear=True,
            ):
                with mock.patch.object(
                    telegram_sender,
                    "_get_telegram_client",
                    return_value=FakeTelegramClient(),
                ):
                    result = telegram_sender.send_telegram_message(
                        "seller_main",
                        "me",
                        "hello",
                    )

        self.assertEqual(
            result,
            {
                "status": "sent",
                "sender_alias": "seller_main",
                "recipient_contact": "me",
                "telegram_message_id": 12345,
            },
        )


if __name__ == "__main__":
    unittest.main()
