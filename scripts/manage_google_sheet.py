#!/usr/bin/env python
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from chat_bot.google_sheet_manager import (
    DEFAULT_SPREADSHEET_ID,
    parse_delimited_row,
    parse_values_json,
    sheet_range,
    GoogleSheetManager,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage the Chat-bot Google Sheet.")
    parser.add_argument(
        "--spreadsheet-id",
        default=DEFAULT_SPREADSHEET_ID,
        help="Google Spreadsheet ID. Defaults to the Chat-bot control sheet.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list-sheets", help="Print spreadsheet sheet titles.")

    init_parser = subparsers.add_parser("init", help="Create required sheets and headers.")
    init_parser.add_argument(
        "--with-default-description",
        action="store_true",
        help="Append default repository description rows to the 'Описание' sheet.",
    )

    add_parser = subparsers.add_parser("add-sheet", help="Create a sheet if it does not exist.")
    add_parser.add_argument("--title", required=True)

    delete_parser = subparsers.add_parser("delete-sheet", help="Delete a sheet by title.")
    delete_parser.add_argument("--title", required=True)

    update_parser = subparsers.add_parser("update-range", help="Update a Google Sheets A1 range.")
    update_parser.add_argument("--range", required=True, dest="a1_range")
    update_parser.add_argument("--values-json", required=True)

    append_parser = subparsers.add_parser("append-row", help="Append one row to a sheet.")
    append_parser.add_argument("--sheet", required=True)
    append_values = append_parser.add_mutually_exclusive_group(required=True)
    append_values.add_argument("--values-json", help='JSON row, for example ["1","2"].')
    append_values.add_argument("--values", help='Delimited row, for example "1|2|3".')
    append_parser.add_argument("--delimiter", default="|")

    cell_parser = subparsers.add_parser("set-cell", help="Set one cell value.")
    cell_parser.add_argument("--sheet", required=True)
    cell_parser.add_argument("--cell", required=True, help="A1 cell address, for example B2.")
    cell_parser.add_argument("--value", required=True)

    clear_parser = subparsers.add_parser("clear", help="Clear an A1 range.")
    clear_parser.add_argument("--range", required=True, dest="a1_range")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        manager = GoogleSheetManager(spreadsheet_id=args.spreadsheet_id)
    except RuntimeError as exc:
        parser.exit(1, f"ERROR: {exc}\n")

    if args.command == "list-sheets":
        for sheet in manager.list_sheets():
            print(f"{sheet.sheet_id}\t{sheet.title}")
        return 0

    if args.command == "init":
        manager.init_structure(include_description_rows=args.with_default_description)
        print("Initialized required sheet structure.")
        return 0

    if args.command == "add-sheet":
        sheet_id = manager.ensure_sheet(args.title)
        print(f"Sheet ready: {args.title} ({sheet_id})")
        return 0

    if args.command == "delete-sheet":
        deleted = manager.delete_sheet(args.title)
        print("Deleted." if deleted else "Sheet did not exist.")
        return 0

    if args.command == "update-range":
        result = manager.update_values(args.a1_range, parse_values_json(args.values_json))
        print(json.dumps(result, ensure_ascii=False))
        return 0

    if args.command == "append-row":
        if args.values_json:
            rows = parse_values_json(args.values_json)
        else:
            rows = [parse_delimited_row(args.values, args.delimiter)]
        result = manager.append_rows(args.sheet, rows)
        print(json.dumps(result, ensure_ascii=False))
        return 0

    if args.command == "set-cell":
        result = manager.set_cell(args.sheet, args.cell, args.value)
        print(json.dumps(result, ensure_ascii=False))
        return 0

    if args.command == "clear":
        result = manager.clear_range(args.a1_range)
        print(json.dumps(result, ensure_ascii=False))
        return 0

    parser.error(f"Unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    sys.exit(main())
