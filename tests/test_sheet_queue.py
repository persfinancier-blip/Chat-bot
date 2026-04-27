import unittest

from chat_bot.sheet_queue import (
    MAILING_COLUMNS,
    STATUS_PENDING,
    STATUS_PROCESSING,
    STATUS_SENT,
    SheetQueue,
    build_default_message_text,
)


class FakeManager:
    def __init__(self):
        self.mailing = [
            MAILING_COLUMNS,
            [
                "SND-1",
                "12345",
                "",
                "RCP-1",
                "@client",
                "daily",
                "",
                "Europe/Moscow",
                STATUS_PENDING,
                "FALSE",
                "",
                "",
                "",
                "",
                "0",
                "",
            ],
        ]
        self.appended = []

    def get_values(self, a1_range):
        if "A1:P" in a1_range:
            return self.mailing
        if "A2:P2" in a1_range:
            return [self.mailing[1]]
        return []

    def update_values(self, a1_range, values):
        if "C2:O2" in a1_range:
            row = self.mailing[1]
            row[2:15] = [str(value) for value in values[0]]
        elif "I2:O2" in a1_range:
            row = self.mailing[1]
            row[8:15] = [str(value) for value in values[0]]
        return {"updatedRange": a1_range}

    def append_rows(self, sheet_title, rows):
        self.appended.extend(rows)
        return {"updates": {"updatedRows": len(rows)}}


class SheetQueueTest(unittest.TestCase):
    def test_claim_next_pending_marks_processing_and_increments_attempts(self):
        queue = SheetQueue(FakeManager())

        task = queue.claim_next_pending("seller_main")

        self.assertIsNotNone(task)
        self.assertEqual(task.values["status"], STATUS_PROCESSING)
        self.assertEqual(task.values["sender_alias"], "seller_main")
        self.assertEqual(task.attempts, 1)

    def test_default_message_text_uses_task_fields(self):
        queue = SheetQueue(FakeManager())
        task = queue.claim_next_pending("seller_main")

        message = build_default_message_text(task)

        self.assertIn("sending_id: SND-1", message)
        self.assertIn("shop_id: 12345", message)
        self.assertIn("variant: daily", message)

    def test_mark_sent_updates_status_and_appends_log(self):
        manager = FakeManager()
        queue = SheetQueue(manager)
        task = queue.claim_next_pending("seller_main")

        queue.mark_sent(task, "123", "hello")

        self.assertEqual(manager.mailing[1][8], STATUS_SENT)
        self.assertEqual(manager.mailing[1][13], "123")
        self.assertEqual(manager.appended[0][2], STATUS_SENT)


if __name__ == "__main__":
    unittest.main()
