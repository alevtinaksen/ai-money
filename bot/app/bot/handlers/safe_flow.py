"""One explicit draft -> confirm flow for text, voice, and receipts."""
import io
import json
import logging
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

router = Router()
router.message.filter(F.chat.type == "private")
router.callback_query.filter(F.message.chat.type == "private")
logger = logging.getLogger(__name__)


def app_keyboard():
    if not settings.WEBAPP_URL.startswith("https://"):
        return None
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="Открыть бюджет", web_app=WebAppInfo(url=settings.WEBAPP_URL))
    ]])


@router.message(CommandStart())
async def start(message: Message):
    async with AsyncSessionLocal() as db:
        await FinanceService.ensure_user_seeded(db, message.from_user.id)
    await message.answer(
        "Бюджет готов. Счёт начинается с нуля. Напишите «расход 250,50 кофе»: "
        "сначала покажу черновик, затем запишу только после подтверждения. "
        "Голос и фото требуют отдельного включения Gemini. Счета и правки — в приложении.",
        reply_markup=app_keyboard(),
    )


async def preview(message: Message, data: bytes | None = None, mime: str | None = None, text_override: str | None = None):
    uid = message.from_user.id
    try:
        consume_preview(uid)
        async with AsyncSessionLocal() as db:
            accounts = await FinanceService.get_accounts(db, uid)
            categories = await FinanceService.get_categories(db, uid)
            names, cats = [a.name for a in accounts], [c.name for c in categories]
            raw_text = text_override if text_override is not None else (message.text or "")
            result = (await AIParserService.parse_media(data, mime, names, cats) if data is not None
                      else await AIParserService.parse_financial_text(raw_text, names, cats))
            if not result.transactions:
                await message.answer(result.clarification or "Не удалось определить операцию. Уточните сумму.")
                return
            draft = await make_draft(db, uid, f"{message.chat.id}:{message.message_id}", result.transactions)
            if draft.status != "pending":
                await message.answer("Это сообщение уже обработано.")
                return
            rows = json.loads(draft.payload)
            lines = ["Проверьте черновик. Ничего ещё не записано:"]
            for item in rows:
                target = f" → {item['to_account_name']}" if item.get("to_account_name") else ""
                cat = f" · {item['category_name']}" if item.get("category_name") else ""
                lines.append(f"{item['type']}: {item['amount']} {item['currency']} · {item['account_name']}{cat}{target}\n{(item.get('note') or '')[:120]}")
            keyboard = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="Подтвердить всё", callback_data=f"confirm:{draft.id}"),
                InlineKeyboardButton(text="Отменить", callback_data=f"cancel:{draft.id}"),
            ]])
            pages = [""]
            for line in lines:
                if len(pages[-1]) + len(line) + 2 > 3500:
                    pages.append("")
                pages[-1] += line + "\n\n"
            for page in pages[:-1]:
                await message.answer(page)
            await message.answer(pages[-1], reply_markup=keyboard)
    except HTTPException as exc:
        await message.answer(str(exc.detail))
    except ValueError as exc:
        await message.answer(str(exc)[:500])
    except Exception:
        logger.error("Draft preparation failed (%s)", "internal error")
        await message.answer("Не удалось подготовить запись. Данные не изменены; попробуйте позже.")


@router.callback_query(F.data.startswith("confirm:"))
@router.callback_query(F.data.startswith("cancel:"))
async def decide(callback: CallbackQuery):
    action, draft_id = callback.data.split(":", 1)
    await callback.answer()
    try:
        async with AsyncSessionLocal() as db:
            if action == "confirm":
                changed = await confirm_draft(db, callback.from_user.id, draft_id)
                text = "Записано в бюджет." if changed else "Уже было записано; повторной записи нет."
            else:
                changed = await cancel_draft(db, callback.from_user.id, draft_id)
                text = "Черновик отменён." if changed else "Черновик уже обработан или недоступен."
        await callback.message.answer(text, reply_markup=app_keyboard())
        await callback.message.edit_reply_markup(reply_markup=None)
    except ValueError as exc:
        await callback.message.answer(str(exc)[:500])
    except Exception:
        logger.error("Draft confirmation failed")
        await callback.message.answer("Не удалось завершить действие. Повторите подтверждение: повторная запись защищена.")


@router.message(F.voice | F.photo)
async def media(message: Message):
    file = message.voice or message.photo[-1]
    if not file.file_size or file.file_size > settings.MAX_UPLOAD_BYTES:
        await message.answer("Максимальный размер — 5 МБ.")
        return
    buffer = io.BytesIO()
    await message.bot.download(file, destination=buffer)
    data = buffer.getvalue()

    if message.voice:
        status_msg = await message.answer("🎙️ Распознаю голос...")
        try:
            transcribed_text = await AIParserService.transcribe_audio(data)
        except Exception:
            transcribed_text = ""

        if not transcribed_text:
            await status_msg.edit_text("❌ Не удалось распознать речь в голосовом сообщении. Попробуйте еще раз или напишите текстом.")
            return

        await status_msg.edit_text(f"🗣️ «{transcribed_text}»\nОбрабатываю...")
        await preview(message, text_override=transcribed_text)
    else:
        await preview(message, data=data, mime="image/jpeg")


@router.message(F.text)
async def text(message: Message):
    if len(message.text) > 10000:
        await message.answer("Слишком длинная запись.")
        return
    await preview(message)
