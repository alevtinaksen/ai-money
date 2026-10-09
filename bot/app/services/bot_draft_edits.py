"""Durable, owner-scoped draft edits with optimistic state checks; no ledger writes."""
import json
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select, update
from app.domain.errors import ConflictError
from app.schemas.finance import AIParsedTransaction, PendingClarification, PositiveMoney, persisted_utc
from app.services.bot_drafts import (
    ACTIVE_STATUSES, BotDraft, build_payload, draft_token, dump_payload, insert_draft,
)
from app.services.finance_svc import FinanceService
from app.services.finance_transactions import validate_links
from app.schemas.finance import TransactionCreate

money = TypeAdapter(PositiveMoney)


async def active_draft(db, user_id, draft_id, token=None):
    draft = await db.scalar(select(BotDraft).where(
        BotDraft.id == draft_id, BotDraft.user_id == user_id).execution_options(populate_existing=True))
    if not draft:
        raise ValueError("Черновик не найден")
    if draft.status not in ACTIVE_STATUSES or persisted_utc(draft.expires_at) <= datetime.now(timezone.utc):
        raise ConflictError("Черновик истёк или уже обработан. Отправьте новую запись")
    if token is not None and draft_token(draft) != token:
        raise ConflictError("Запись изменилась. Используйте кнопки последнего сообщения")
    return draft


async def replace_state(db, draft, status, payload):
    result = await db.execute(update(BotDraft).where(
        BotDraft.id == draft.id, BotDraft.user_id == draft.user_id,
        BotDraft.status == draft.status, BotDraft.payload == draft.payload,
        BotDraft.expires_at > datetime.now(timezone.utc),
    ).values(status=status, payload=dump_payload(payload),
             expires_at=datetime.now(timezone.utc) + timedelta(minutes=30)
             ).execution_options(synchronize_session=False))
    if result.rowcount != 1:
        await db.rollback()
        raise ConflictError("Запись уже изменилась. Используйте последние кнопки")
    await db.commit()
    await db.refresh(draft)
    return draft


async def make_clarification(db, user_id, source_id, pending):
    existing = await db.scalar(select(BotDraft).where(
        BotDraft.user_id == user_id, BotDraft.source_id == source_id))
    if existing:
        return existing
    pending = PendingClarification.model_validate(pending)
    return await insert_draft(db, user_id, source_id,
                              {"pending": pending.model_dump(mode="json")}, "clarifying")


def single_row(draft):
    data = json.loads(draft.payload)
    rows = data if isinstance(data, list) else data.get("rows", [])
    if len(rows) != 1:
        raise ValueError("Пакет операций исправляйте в приложении или новым сообщением")
    return rows[0]


async def begin_edit(db, user_id, draft_id, token, field):
    draft = await active_draft(db, user_id, draft_id, token)
    if draft.status == "clarifying" and field == "amount":
        data = json.loads(draft.payload)
        data["manual"] = True
        return await replace_state(db, draft, "clarifying", data)
    if draft.status != "pending":
        raise ConflictError("Сначала завершите текущее уточнение")
    row = single_row(draft)
    if field == "category":
        if row["type"] == "transfer":
            raise ValueError("У перевода нет категории")
        categories = await FinanceService.get_categories(db, user_id)
        choices = [None] + [cat.id for cat in categories if cat.type in ("both", row["type"])]
    elif field == "amount":
        choices = []
    else:
        raise ValueError("Неизвестное поле")
    return await replace_state(db, draft, f"editing_{field}", {"rows": [row], "choices": choices})


async def choose_amount(db, user_id, draft_id, token, *, option=None, amount=None):
    draft = await active_draft(db, user_id, draft_id, token)
    if draft.status == "clarifying":
        pending = PendingClarification.model_validate(json.loads(draft.payload)["pending"])
        if option is not None:
            if option < 0 or option >= len(pending.suggested_options):
                raise ValueError("Вариант суммы недоступен")
            amount = pending.suggested_options[option]
        amount = validate_amount(amount)
        proposal = AIParsedTransaction(amount=amount, **pending.model_dump(exclude={
            "question", "suggested_options", "suggested_amount", "currency"}))
        rows = await build_payload(db, user_id, [proposal], pending.currency)
        rows[0]["_revision"] = 1
    elif draft.status == "editing_amount" and option is None:
        row = single_row(draft)
        row["amount"] = str(validate_amount(amount))
        row["_revision"] = row.get("_revision", 0) + 1
        await validate_links(db, user_id, TransactionCreate.model_validate({
            key: value for key, value in row.items() if key in TransactionCreate.model_fields}))
        rows = [row]
    else:
        raise ConflictError("Эта запись сейчас не ожидает сумму")
    return await replace_state(db, draft, "pending", rows)


def validate_amount(amount):
    try:
        return money.validate_python(amount)
    except (ValidationError, ValueError, TypeError):
        raise ValueError("Укажите положительную сумму с точностью до копеек, например 5000 или 250,50") from None


def manual_amount(text):
    text = re.sub(r"\s*(?:руб(?:ль|ля|лей)?\.?|₽)\s*$", "", text.strip(), flags=re.I)
    if not re.fullmatch(r"(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d{1,2})?", text):
        raise ValueError("Пришлите только сумму, например 5000 или 250,50")
    return validate_amount(Decimal(re.sub(r"\s", "", text).replace(",", ".")))


async def amount_wait(db, user_id):
    # A plain numeric reply refers only to the latest active interaction.
    # An older amount prompt must not hijack a newer transaction message.
    draft = await db.scalar(select(BotDraft).where(
        BotDraft.user_id == user_id, BotDraft.status.in_(ACTIVE_STATUSES),
        BotDraft.expires_at > datetime.now(timezone.utc)
    ).order_by(BotDraft.expires_at.desc(), BotDraft.id.desc()).limit(1))
    return draft if draft and draft.status in ("clarifying", "editing_amount") else None


async def choose_category(db, user_id, draft_id, token, index):
    draft = await active_draft(db, user_id, draft_id, token)
    if draft.status != "editing_category":
        raise ConflictError("Эта запись сейчас не ожидает категорию")
    data = json.loads(draft.payload)
    if index < 0 or index >= len(data["choices"]):
        raise ValueError("Категория недоступна")
    row = single_row(draft)
    row["category_id"] = data["choices"][index]
    row["_revision"] = row.get("_revision", 0) + 1
    await validate_links(db, user_id, TransactionCreate.model_validate({
        key: value for key, value in row.items() if key in TransactionCreate.model_fields}))
    return await replace_state(db, draft, "pending", [row])


async def back_to_draft(db, user_id, draft_id, token):
    draft = await active_draft(db, user_id, draft_id, token)
    if draft.status == "clarifying" and json.loads(draft.payload).get("manual"):
        data = json.loads(draft.payload)
        data.pop("manual")
        return await replace_state(db, draft, "clarifying", data)
    if draft.status not in ("editing_amount", "editing_category"):
        raise ConflictError("Вернуться к черновику сейчас нельзя")
    return await replace_state(db, draft, "pending", [single_row(draft)])
