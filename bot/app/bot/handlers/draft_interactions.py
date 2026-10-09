"""One-tap field selection and numeric replies continue the same durable draft."""
import re
import uuid
import hashlib
from app.schemas.finance import PendingClarification
from app.services.bot_drafts import draft_token
from app.services.bot_draft_edits import (
    active_draft, amount_wait, back_to_draft, begin_edit, choose_amount,
    choose_category, make_clarification, manual_amount,
)
from app.bot.handlers.draft_views import show_draft


class DraftDeliveryError(Exception):
    def __init__(self, draft_id):
        super().__init__("Draft message delivery failed")
        self.draft_id = draft_id


async def handle_edit(callback, db):
    data = callback.data or ""
    if data in ("draft:n:expense", "draft:n:income"):
        kind = data.rsplit(":", 1)[1]
        interaction = hashlib.sha256(callback.id.encode()).hexdigest()[:16]
        draft = await make_clarification(db, callback.from_user.id,
            f"manual:{callback.message.chat.id}:{callback.message.message_id}:{kind}:{interaction}",
            PendingClarification(question="Пришлите сумму. Затем можно выбрать категорию.", type=kind))
        await show_draft(callback.message, db, draft)
        return
    match = re.fullmatch(r"draft:([amkcpb]):([a-f0-9]{32}):([a-f0-9]{12})(?::(\d{1,4}))?", data)
    if not match:
        raise ValueError("Кнопка недоступна. Используйте последнее сообщение")
    action, draft_id, token, index = match.groups()
    draft_id = str(uuid.UUID(draft_id))
    user_id = callback.from_user.id
    page = 0
    if action == "a" and index is not None:
        draft = await choose_amount(db, user_id, draft_id, token, option=int(index))
    elif action in ("m", "k") and index is None:
        draft = await begin_edit(db, user_id, draft_id, token, "amount" if action == "m" else "category")
    elif action == "c" and index is not None:
        draft = await choose_category(db, user_id, draft_id, token, int(index))
    elif action == "p" and index is not None:
        draft = await active_draft(db, user_id, draft_id, token)
        if draft.status != "editing_category":
            raise ValueError("Выбор категорий уже завершён")
        page = int(index)
    elif action == "b" and index is None:
        draft = await back_to_draft(db, user_id, draft_id, token)
    else:
        raise ValueError("Кнопка недоступна")
    await show_draft(callback.message, db, draft, edit=True, page=page)


async def handle_amount_reply(message, db):
    # Full new operations continue through the normal parser, rather than
    # overwriting an older draft. Numeric-only replies are explicit amount edits.
    text = message.text.strip()
    if not re.fullmatch(r"[+-]?\d[\d\s.,]*(?:\s*(?:руб(?:ль|ля|лей)?\.?|₽))?", text, re.I):
        return False
    draft = await amount_wait(db, message.from_user.id)
    if not draft:
        return False
    amount = manual_amount(text)
    draft = await choose_amount(db, message.from_user.id, draft.id, draft_token(draft), amount=amount)
    try:
        await show_draft(message, db, draft)
    except Exception:
        # Sending can fail after commit. Re-open this amount editor so a numeric
        # retry continues it, rather than creating an unrelated transaction.
        try:
            await begin_edit(db, message.from_user.id, draft.id, draft_token(draft), "amount")
        except ValueError:
            pass  # A concurrent explicit confirm/cancel must never be undone.
        raise DraftDeliveryError(draft.id) from None
    return True


async def recover_draft(callback, db, draft_id=None):
    """A failed Telegram edit or stale button must not strand a persisted editor."""
    if draft_id is None:
        match = re.fullmatch(r"draft:[amkcpb]:([a-f0-9]{32}):[a-f0-9]{12}(?::\d{1,4})?", callback.data or "")
        if not match:
            return
        draft_id = str(uuid.UUID(match[1]))
    try:
        draft = await active_draft(db, callback.from_user.id, draft_id)
    except ValueError:
        return
    await show_draft(callback.message, db, draft)
