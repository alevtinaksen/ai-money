"""One explicit draft -> confirm flow for text, voice, and receipts."""
import io
import asyncio
import logging
from app.services.runtime_timing import timed_operation, timed_stage
from fastapi import HTTPException
from app.services.preview_budget import consume_preview
from aiogram import F, Router
from aiogram.filters import CommandStart
from aiogram.types import Message, CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.ai_parser import AIParserService
from app.services.bot_drafts import make_draft, confirm_draft, cancel_draft
from app.services.finance_svc import FinanceService
from app.services.bot_draft_edits import make_clarification
from app.bot.handlers.draft_views import show_draft, manual_keyboard, format_money as format_money
from app.bot.handlers.draft_interactions import handle_edit, handle_amount_reply, recover_draft, DraftDeliveryError

router = Router()
router.message.filter(F.chat.type == "private")
router.callback_query.filter(F.message.chat.type == "private")
logger = logging.getLogger(__name__)


class UploadBuffer(io.BytesIO):
    """Telegram file_size is metadata; enforce the cap while receiving bytes."""
    def write(self, data):
        if self.tell() + len(data) > settings.MAX_UPLOAD_BYTES:
            raise ValueError("Максимальный размер — 5 МБ.")
        return super().write(data)


def app_keyboard():
    if not settings.WEBAPP_URL.startswith("https://"):
        return None
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="📱 Открыть в приложении", web_app=WebAppInfo(url=settings.WEBAPP_URL))
    ]])


@router.message(CommandStart())
async def start(message: Message):
    user_id = message.from_user.id
    name = message.from_user.first_name or "друг"
    async with AsyncSessionLocal() as db:
        await FinanceService.ensure_user_seeded(db, user_id)

    # Set Menu Button to open Mini App
    if settings.WEBAPP_URL.startswith("https://"):
        try:
            from aiogram.types import MenuButtonWebApp
            await message.bot.set_chat_menu_button(
                chat_id=message.chat.id,
                menu_button=MenuButtonWebApp(
                    text="📊 Бюджет",
                    web_app=WebAppInfo(url=settings.WEBAPP_URL)
                )
            )
        except Exception:
            pass

    text = (
        f"👋 Привет, {name}!\n\n"
        "Я твой персональный финансовый ассистент с искусственным интеллектом.\n\n"
        "⚡ Быстрый ввод расходов:\n"
        "• Отправь голосовое сообщение (например: «Кофе 250 с карты Альфа»)\n"
        "• Или напиши текстом (например: «Такси 450»)\n\n"
        "📊 Нажми кнопку «Бюджет» внизу или используй Mini App для просмотра красивых дашбордов, счетов и аналитики!"
    )
    await message.answer(text, reply_markup=app_keyboard())


@timed_operation("bot_preview")
async def preview(message: Message, data: bytes | None = None, mime: str | None = None, text_override: str | None = None, budget_consumed=False):
    uid = message.from_user.id
    try:
        if not budget_consumed:
            consume_preview(uid)
        async with AsyncSessionLocal() as db:
            accounts = await FinanceService.get_accounts(db, uid)
            categories = await FinanceService.get_categories(db, uid)
            names, cats = [a.name for a in accounts], [c.name for c in categories]

            raw_text = text_override if text_override is not None else (message.text or "")
            result = (await AIParserService.parse_media(data, mime, names, cats) if data is not None
                      else await AIParserService.parse_financial_text(raw_text, names, cats))
            if result.pending:
                draft = await make_clarification(db, uid, f"{message.chat.id}:{message.message_id}", result.pending)
                await show_draft(message, db, draft)
                return
            if not result.transactions:
                await message.answer(result.clarification or "Не удалось определить операцию. Уточните сумму.",
                                     reply_markup=manual_keyboard())
                return
            draft = await make_draft(db, uid, f"{message.chat.id}:{message.message_id}", result.transactions)
            await show_draft(message, db, draft)
    except HTTPException as exc:
        await message.answer(str(exc.detail))
    except ValueError as exc:
        await message.answer(str(exc)[:500], reply_markup=manual_keyboard())
    except Exception as exc:
        # SQL/provider exception representations can include notes, amounts or keys.
        logger.error("Draft preparation failed (%s)", type(exc).__name__)
        await message.answer("Не удалось подготовить запись. Данные не изменены; попробуйте позже.")


@router.callback_query(F.data.startswith("confirm:"))
@router.callback_query(F.data.startswith("cancel:"))
@router.callback_query(F.data.startswith("edit:"))
@timed_operation("bot_confirmation")
async def decide(callback: CallbackQuery):
    await callback.answer()
    draft_id = None
    try:
        parts = callback.data.split(":")
        if len(parts) not in (2, 3):
            raise ValueError("Кнопка недоступна")
        action, draft_id = parts[:2]
        token = parts[2] if len(parts) == 3 else None
        async with AsyncSessionLocal() as db:
            if action == "confirm":
                changed = await confirm_draft(db, callback.from_user.id, draft_id, token)
                text = "✅ Запись сохранена в бюджете." if changed else "Уже было сохранено."
                await callback.message.edit_text(text)
            else:
                changed = await cancel_draft(db, callback.from_user.id, draft_id, token)
                text = ("Отправьте исправленную запись новым сообщением. Прежний черновик отменён."
                        if changed and action == "edit" else
                        "❌ Запись отменена." if changed else "Черновик уже обработан или недоступен.")
                await callback.message.edit_text(text)
    except ValueError as exc:
        await callback.message.answer(str(exc)[:500])
        if draft_id:
            await recover_current(callback, draft_id)
    except Exception as exc:
        logger.error("Draft confirmation failed (%s)", type(exc).__name__)
        await callback.message.answer("Не удалось завершить действие. Попробуйте позже.")
        if draft_id:
            await recover_current(callback, draft_id)


async def recover_current(callback, draft_id=None):
    try:
        async with AsyncSessionLocal() as db:
            await recover_draft(callback, db, draft_id)
    except Exception as exc:
        logger.error("Draft recovery failed (%s)", type(exc).__name__)


@router.callback_query(F.data.startswith("draft:"))
async def edit_draft(callback: CallbackQuery):
    await callback.answer()
    try:
        async with AsyncSessionLocal() as db:
            await handle_edit(callback, db)
    except ValueError as exc:
        await callback.message.answer(str(exc)[:500])
        await recover_current(callback)
    except Exception as exc:
        logger.error("Draft editing failed (%s)", type(exc).__name__)
        await callback.message.answer("Не удалось изменить черновик. Ничего не записано; попробуйте позже.")
        await recover_current(callback)


@router.message(F.voice | F.audio | F.document | F.photo)
async def media(message: Message):
    file = message.voice or message.audio or message.document or message.photo[-1]
    is_audio = bool(message.voice or message.audio or message.document)
    if file.file_size is not None and file.file_size <= 0:
        await message.answer("Файл пустой. Отправьте новую запись или введите расход текстом.")
        return
    if file.file_size is not None and file.file_size > settings.MAX_UPLOAD_BYTES:
        await message.answer("Максимальный размер — 5 МБ.")
        return
    try:
        from app.services.ai_provider import provider_for, audio_mime, validate_audio
        mime = (audio_mime(getattr(file, "mime_type", None) or ("audio/ogg" if message.voice else None),
                           getattr(file, "file_name", None)) if is_audio else "image/jpeg")
        provider_for("audio" if is_audio else "image")
        consume_preview(message.from_user.id)
        with UploadBuffer() as buffer:
            # Include getFile in the deadline, not only Telegram's streaming IO.
            async with asyncio.timeout(35):
                with timed_stage("bot_download"):
                    await message.bot.download(file, destination=buffer, timeout=30)
            data = buffer.getvalue()
        if not data:
            raise ValueError("Файл пустой. Отправьте новую запись или введите расход текстом.")
        if is_audio:
            mime = validate_audio(data, mime)
        await preview(message, data=data, mime=mime, budget_consumed=True)
    except (ValueError, HTTPException) as exc:
        await message.answer(str(getattr(exc, "detail", exc))[:500])
    except Exception as exc:
        logger.warning("Telegram media download failed (%s)", type(exc).__name__)
        await message.answer("Не удалось загрузить файл. Ничего не записано; отправьте его снова или введите расход текстом.")


@router.message(F.text)
async def text(message: Message):
    if len(message.text) > 10000:
        await message.answer("Слишком длинная запись.")
        return
    try:
        async with AsyncSessionLocal() as db:
            if await handle_amount_reply(message, db):
                return
    except ValueError as exc:
        await message.answer(str(exc)[:500])
        return
    except Exception as exc:
        logger.error("Draft amount reply failed (%s)", type(exc).__name__)
        await message.answer("Не удалось уточнить сумму. Ничего не записано; попробуйте ещё раз.")
        if isinstance(exc, DraftDeliveryError):
            try:
                async with AsyncSessionLocal() as db:
                    from app.services.bot_draft_edits import active_draft
                    draft = await active_draft(db, message.from_user.id, exc.draft_id)
                    await show_draft(message, db, draft)
            except Exception as recovery:
                logger.error("Draft amount recovery failed (%s)", type(recovery).__name__)
        return
    await preview(message)
