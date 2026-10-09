"""Replay creation intent, never deduplicate intentionally identical accounts by name."""
import hashlib
import json
from decimal import Decimal
from sqlalchemy import select
from app.domain.errors import ConflictError
from app.models.creations import EntityCreation
from app.services.finance_transactions import owned


def creation_fingerprint(data):
    payload = data.model_dump(mode="json", exclude={"client_id"})
    for field in ("balance", "budget_limit"):
        if payload.get(field) is not None:
            payload[field] = str(Decimal(payload[field]).quantize(Decimal("0.01")))
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


async def replay_creation(db, model, user_id, data):
    if not data.client_id:
        return None
    command = await db.scalar(select(EntityCreation).where(
        EntityCreation.user_id == user_id, EntityCreation.kind == model.__tablename__,
        EntityCreation.client_id == data.client_id,
    ))
    if command is None:
        return None
    if command.fingerprint != creation_fingerprint(data):
        raise ConflictError("Ключ создания уже использован для других данных")
    result = await owned(db, model, user_id, command.object_id, active=False)
    if result is None:
        raise ConflictError("Сохранённый результат недоступен; сначала сверьте данные")
    return result


def remember_creation(db, model, user_id, data, entity):
    if data.client_id:
        db.add(EntityCreation(user_id=user_id, kind=model.__tablename__,
            client_id=data.client_id, fingerprint=creation_fingerprint(data), object_id=entity.id))
