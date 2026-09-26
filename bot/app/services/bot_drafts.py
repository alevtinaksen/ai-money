"""Durable preview/confirm protocol shared by Telegram handlers."""
import json
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import BigInteger, Column, DateTime, String, Text, UniqueConstraint, select, update
from app.core.database import Base
from app.domain.errors import ConflictError
from app.schemas.finance import TransactionCreate
from app.services.finance_svc import FinanceService


class BotDraft(Base):
    __tablename__ = "bot_drafts"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(BigInteger, nullable=False, index=True)
    source_id = Column(String(100), nullable=False)
    payload = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "source_id"),)


async def make_draft(db, user_id: int, source_id: str, proposals: list) -> BotDraft:
    existing = await db.scalar(select(BotDraft).where(BotDraft.user_id == user_id, BotDraft.source_id == source_id))
    if existing:
        return existing
    accounts = await FinanceService.get_accounts(db, user_id)
    categories = await FinanceService.get_categories(db, user_id)
    default = await FinanceService.get_default_account(db, user_id)
    if not default:
        raise ValueError("Сначала создайте счёт в приложении")
    payload = []
    for proposal in proposals:
        account = resolve_name(accounts, proposal.account_name) if proposal.account_name else default
        target = resolve_name(accounts, proposal.to_account_name) if proposal.to_account_name else None
        category = resolve_name(categories, proposal.category_name) if proposal.category_name else None
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
        payload.append(item)
    if not payload or len(payload) > 20:
        raise ValueError("Нет операций для подтверждения")
    draft = BotDraft(user_id=user_id, source_id=source_id, payload=json.dumps(payload, ensure_ascii=False),
                     expires_at=datetime.now(timezone.utc) + timedelta(minutes=30))
    db.add(draft)
    await db.commit()
    return draft


def resolve_name(objects, name):
    matches = [obj for obj in objects if obj.name.casefold() == name.casefold()]
    if len(matches) != 1:
        raise ValueError("Счёт или категория не определены однозначно; уточните запись в приложении")
    return matches[0]


async def confirm_draft(db, user_id, draft_id):
    draft = await db.scalar(select(BotDraft).where(BotDraft.id == draft_id, BotDraft.user_id == user_id))
    if not draft:
        raise ValueError("Черновик не найден")
    if draft.status == "confirmed":
        return False
    result = await db.execute(update(BotDraft).where(
        BotDraft.id == draft_id, BotDraft.user_id == user_id, BotDraft.status == "pending",
        BotDraft.expires_at > datetime.now(timezone.utc)
    ).values(status="confirmed"))
    if result.rowcount != 1:
        await db.rollback()
        raise ConflictError("Черновик истёк или отменён; создайте новый")
    try:
        for item in json.loads(draft.payload):
            clean = {k:v for k,v in item.items() if k not in ("account_name","currency","to_account_name")}
            await FinanceService.create_transaction(db, user_id, TransactionCreate(**clean), commit=False)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return True


async def cancel_draft(db, user_id, draft_id):
    result = await db.execute(update(BotDraft).where(
        BotDraft.id == draft_id, BotDraft.user_id == user_id, BotDraft.status == "pending"
    ).values(status="cancelled"))
    await db.commit()
    return result.rowcount == 1
