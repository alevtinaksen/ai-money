"""Durable preview/confirm protocol shared by Telegram handlers."""
import json
import uuid
import hashlib
from datetime import datetime, timedelta, timezone
from sqlalchemy import BigInteger, Column, DateTime, String, Text, UniqueConstraint, select, update
from app.core.database import Base
from app.domain.errors import ConflictError
from app.schemas.finance import TransactionCreate
from app.services.finance_svc import FinanceService
from app.services.runtime_timing import timed_operation

ACTIVE_STATUSES = ("pending", "clarifying", "editing_amount", "editing_category")


def draft_token(draft):
    return hashlib.sha256((draft.status + draft.payload).encode()).hexdigest()[:12]


def dump_payload(payload):
    return json.dumps(payload, ensure_ascii=False)


class BotDraft(Base):
    __tablename__ = "bot_drafts"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(BigInteger, nullable=False, index=True)
    source_id = Column(String(100), nullable=False)
    payload = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "source_id"),)


@timed_operation("draft_create")
async def make_draft(db, user_id: int, source_id: str, proposals: list) -> BotDraft:
    existing = await db.scalar(select(BotDraft).where(BotDraft.user_id == user_id, BotDraft.source_id == source_id))
    if existing:
        return existing
    payload = await build_payload(db, user_id, proposals)
    return await insert_draft(db, user_id, source_id, payload)


async def build_payload(db, user_id, proposals, currency=None):
    accounts = await FinanceService.get_accounts(db, user_id)
    if currency is not None:
        accounts = [account for account in accounts if account.currency == currency]
        if not accounts:
            raise ValueError(f"Для суммы в {currency} сначала создайте счёт этой валюты в приложении")
    categories = await FinanceService.get_categories(db, user_id)
    default = next((account for account in accounts if account.is_default), accounts[0] if accounts else None)
    if not default:
        raise ValueError("Сначала создайте счёт в приложении")
    payload = []
    for proposal in proposals:
        account = resolve_name(accounts, proposal.account_name) if proposal.account_name else default
        target = resolve_name(accounts, proposal.to_account_name) if proposal.to_account_name else None
        compatible = [cat for cat in categories if cat.type in (proposal.type, "both")]
        matches = [cat for cat in compatible if proposal.category_name
                   and cat.name.casefold() == proposal.category_name.casefold()]
        # Uncertain categories stay unassigned for the picker; never choose a
        # same-named category of the opposite operation type.
        category = matches[0] if len(matches) == 1 else None
        if proposal.type == "transfer" and not target:
            raise ValueError("Для перевода выберите оба счёта в приложении")
        item = TransactionCreate(
            account_id=account.id, to_account_id=target.id if target else None,
            category_id=category.id if category and proposal.type != "transfer" else None,
            amount=proposal.amount, type=proposal.type, note=proposal.note,
            client_id=str(uuid.uuid4()),
        ).model_dump(mode="json")
        item["account_name"] = account.name
        item["currency"] = account.currency
        item["to_account_name"] = target.name if target else None
        item["_revision"] = 0
        payload.append(item)
    if not payload or len(payload) > 20:
        raise ValueError("Нет операций для подтверждения")
    return payload


async def insert_draft(db, user_id, source_id, payload, status="pending"):
    draft = BotDraft(user_id=user_id, source_id=source_id, payload=dump_payload(payload), status=status,
                     expires_at=datetime.now(timezone.utc) + timedelta(minutes=30))
    db.add(draft)
    await db.commit()
    return draft


def resolve_name(objects, name):
    matches = [obj for obj in objects if obj.name.casefold() == name.casefold()]
    if len(matches) != 1:
        raise ValueError("Счёт или категория не определены однозначно; уточните запись в приложении")
    return matches[0]


@timed_operation("draft_confirm")
async def confirm_draft(db, user_id, draft_id, expected_token=None):
    draft = await db.scalar(select(BotDraft).where(BotDraft.id == draft_id, BotDraft.user_id == user_id)
                            .execution_options(populate_existing=True))
    if not draft:
        raise ValueError("Черновик не найден")
    if draft.status == "confirmed":
        return False
    if draft.status != "pending":
        raise ConflictError("Сначала уточните запись; она ещё не готова к сохранению")
    rows = json.loads(draft.payload)
    if ((expected_token is not None and expected_token != draft_token(draft))
            or (expected_token is None and any(item.get("_revision", 0) for item in rows))):
        raise ConflictError("Запись изменилась. Используйте кнопки последнего черновика")
    result = await db.execute(update(BotDraft).where(
        BotDraft.id == draft_id, BotDraft.user_id == user_id, BotDraft.status == "pending",
        BotDraft.payload == draft.payload,
        BotDraft.expires_at > datetime.now(timezone.utc)
    ).values(status="confirmed").execution_options(synchronize_session=False))
    if result.rowcount != 1:
        await db.rollback()
        raise ConflictError("Черновик истёк или отменён; создайте новый")
    try:
        for item in rows:
            clean = {k:v for k,v in item.items() if k in TransactionCreate.model_fields}
            await FinanceService.create_transaction(db, user_id, TransactionCreate(**clean), commit=False)
        await db.commit()
        await db.refresh(draft)
    except Exception:
        await db.rollback()
        raise
    return True


async def cancel_draft(db, user_id, draft_id, expected_token=None):
    draft = await db.scalar(select(BotDraft).where(BotDraft.id == draft_id, BotDraft.user_id == user_id)
                            .execution_options(populate_existing=True))
    if not draft or draft.status not in ACTIVE_STATUSES:
        return False
    if expected_token is not None and expected_token != draft_token(draft):
        raise ConflictError("Запись изменилась. Используйте последние кнопки")
    if expected_token is None and (draft.status != "pending" or any(
            item.get("_revision", 0) for item in json.loads(draft.payload))):
        raise ConflictError("Запись изменилась. Используйте последние кнопки")
    result = await db.execute(update(BotDraft).where(
        BotDraft.id == draft_id, BotDraft.user_id == user_id, BotDraft.status == draft.status,
        BotDraft.payload == draft.payload
    ).values(status="cancelled").execution_options(synchronize_session=False))
    await db.commit()
    return result.rowcount == 1
