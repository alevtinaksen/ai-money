"""Bounded canonical CSV parsing; source fields are immutable after preview."""

import csv
import hashlib
import io
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from app.schemas.finance import TransactionCreate

MAX_BYTES = 1024 * 1024
MAX_ROWS = 1000


def source_key(row: dict) -> str:
    if row["source_id"]:
        return "id:" + hashlib.sha256(row["source_id"].encode()).hexdigest()
    content = [row["date"], row["signed_amount"], row["currency"], row["description"]]
    return "fp:" + hashlib.sha256(json.dumps(content, ensure_ascii=False).encode()).hexdigest()


def parse_csv(content: bytes, account_id: str, currency: str) -> list[dict]:
    if not content or len(content) > MAX_BYTES:
        raise ValueError("CSV должен быть непустым и не больше 1 МБ")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeError:
        raise ValueError("CSV должен быть в UTF-8") from None
    reader = csv.DictReader(io.StringIO(text))
    required = {"date", "amount", "currency", "description"}
    if (
        not reader.fieldnames
        or not required.issubset(reader.fieldnames)
        or len(reader.fieldnames) != len(set(reader.fieldnames))
    ):
        raise ValueError("Нужны уникальные колонки date,amount,currency,description")
    rows = []
    for raw in reader:
        if len(rows) >= MAX_ROWS:
            raise ValueError("Допустимо не более 1000 строк")
        if None in raw:
            raise ValueError("Число значений не совпадает с заголовком CSV")
        row = normalize_row(raw, account_id, currency)
        row["source_key"] = source_key(row)
        rows.append(row)
    if not rows:
        raise ValueError("CSV не содержит операций")
    return rows


def normalize_row(raw: dict, account_id: str, currency: str) -> dict:
    row = {
        "id": str(uuid.uuid4()),
        "date": raw.get("date") or "",
        "amount": "0",
        "signed_amount": raw.get("amount") or "",
        "currency": (raw.get("currency") or "").upper(),
        "description": raw.get("description") or "",
        "source_id": (raw.get("source_id") or "").strip(),
        "status": (raw.get("status") or "posted").lower(),
        "type": "expense",
        "category_id": None,
        "note": raw.get("description") or "",
        "include": True,
        "duplicate": False,
        "force_duplicate": False,
        "error": None,
    }
    try:
        if len(row["source_id"]) > 200 or len(row["description"]) > 2000:
            raise ValueError("Слишком длинный идентификатор или описание")
        if row["status"] != "posted":
            raise ValueError("Импортируются только проведённые операции posted")
        if (raw.get("type") or "").lower() == "transfer":
            raise ValueError("Перевод создаётся вручную между двумя счетами")
        amount = Decimal(row["signed_amount"])
        kind = "income" if amount > 0 else "expense"
        date = datetime.fromisoformat(row["date"].replace("Z", "+00:00"))
        date = (
            date.replace(tzinfo=timezone.utc)
            if date.tzinfo is None
            else date.astimezone(timezone.utc)
        )
        data = TransactionCreate(
            account_id=account_id, amount=abs(amount), type=kind, created_at=date
        )
        if row["currency"] != currency:
            raise ValueError("Валюта строки отличается от валюты счёта")
        row.update(
            amount=str(data.amount.quantize(Decimal("0.01"))),
            signed_amount=str(amount.quantize(Decimal("0.01"))),
            type=kind,
            date=date.isoformat(),
        )
    except (ValueError, InvalidOperation):
        row.update(
            include=False,
            error="Проверьте дату, ненулевую сумму с копейками, валюту и статус posted; переводы импортировать нельзя",
        )
    return row
