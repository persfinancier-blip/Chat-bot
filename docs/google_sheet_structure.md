# Google Sheet Structure

Таблица `Рассылка отчетов` используется как панель управления чат-ботом рассылок.

Spreadsheet ID:

```text
1OdgpoZiwyAkwnOxRtgr5bFx8WyN2RbO83Fwjss0pUrg
```

## Листы

### Описание

Назначение: краткая документация внутри таблицы.

Колонки:

- `Раздел`
- `Описание`

### Конфигурация

Назначение: глобальные настройки работы бота.

Колонки:

- `key`
- `value`
- `comment`

Основные ключи:

- `bot_enabled`
- `dry_run`
- `poll_interval_sec`
- `default_timezone`
- `default_sender_alias`
- `max_messages_per_run`
- `telegram_enabled`

### Отправители

Назначение: алиасы Telegram-сессий отправителей.

Колонки:

- `sender_alias`
- `display_name`
- `session_ref`
- `is_active`
- `comment`
- `updated_at`

### Получатели

Назначение: клиенты и получатели сообщений.

Колонки:

- `recipient_id`
- `client_name`
- `shop_id`
- `recipient_contact`
- `telegram_chat_id`
- `is_active`
- `comment`
- `updated_at`

### Шаблоны

Назначение: варианты рассылок и шаблоны текста.

Колонки:

- `mailing_variant`
- `title`
- `template_text`
- `metrics_source`
- `is_active`
- `comment`
- `updated_at`

### Рассылка

Назначение: очередь заданий на отправку. Сервер пишет задачи со статусом `pending`, локальный Windows sender обрабатывает их через Telethon.

Колонки:

- `sending_id`
- `shop_id`
- `sender_alias`
- `recipient_id`
- `recipient_contact`
- `mailing_variant`
- `send_at`
- `timezone`
- `status`
- `dry_run`
- `message_text`
- `last_error`
- `sent_at`
- `telegram_message_id`
- `attempts`
- `comment`

Пример строки:

```text
SND-000001 | 12345 | seller_main | RCP-000001 | @test_client | daily_revenue_report | 2026-04-27 10:00 | Europe/Moscow | pending | FALSE |  |  |  |  | 0 | тестовая строка
```

### Метрики

Назначение: табличные данные для формирования сообщений.

Колонки:

- `shop_id`
- `metric_date`
- `revenue`
- `drr`
- `avg_check`
- `orders`
- `spend`
- `comment`

Пример строки:

```text
12345 | 2026-04-27 | 100000 | 12.5% | 2500 | 40 | 12500 | тестовые данные
```

### Лог отправок

Назначение: история попыток отправки и ошибок.

Колонки:

- `log_id`
- `sending_id`
- `status`
- `sender_alias`
- `recipient_contact`
- `message_text`
- `error_text`
- `telegram_message_id`
- `created_at`
- `comment`

Лист `Лог отправок` заполняется локальным sender-воркером. При ручной настройке таблицы создаются только заголовки.

## Допустимые статусы

Для листа `Рассылка`:

- `pending` - сервер поставил задачу, локальный sender может ее взять.
- `processing` - локальный sender взял строку в работу и увеличил `attempts`.
- `sent` - сообщение отправлено или dry-run успешно обработан.
- `failed` - отправка завершилась ошибкой, текст ошибки записан в `last_error`.

Legacy/manual statuses вроде `draft`, `ready`, `test_ready`, `sending`, `error`, `disabled` локальным sender не обрабатываются.

## Ретраи и защита от повторов

- Сервер не отправляет Telegram и не использует Telethon.
- Сервер создает задачи только со статусом `pending`.
- Локальный sender обрабатывает только `pending`.
- Перед отправкой sender меняет статус на `processing` и увеличивает `attempts`.
- Успех: `status=sent`, `sent_at`, `telegram_message_id`, пустой `last_error`.
- Ошибка: `status=failed`, заполненный `last_error`, пустой `telegram_message_id`.
- Повторный локальный запуск защищен файлом `logs/sender.lock`.

Для поля `dry_run`:

- `TRUE` - тестовый режим без реальной отправки.
- `FALSE` - реальная отправка.

Глобальная настройка `dry_run` на листе `Конфигурация` может принудительно переводить все отправки в тестовый режим.
