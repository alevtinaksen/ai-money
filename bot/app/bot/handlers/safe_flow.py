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
        "• Или напиши текстом (например: «Такси 450 и аптека 1200»)\n\n"
        "📊 Нажми кнопку «Бюджет» внизу или используй Mini App для просмотра красивых дашбордов, счетов и аналитики!"
    )
    await message.answer(text, reply_markup=app_keyboard())


async def preview(message: Message, data: bytes | None = None, mime: str | None = None, text_override: str | None = None):
    uid = message.from_user.id
    try:
        consume_preview(uid)
        async with AsyncSessionLocal() as db:
            accounts = await FinanceService.get_accounts(db, uid)
            categories = await FinanceService.get_categories(db, uid)
            names, cats = [a.name for a in accounts], [c.name for c in categories]
            acc_map = {a.name: a for a in accounts}
            cat_map = {c.name: c for c in categories}

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

            for item in rows:
                type_sym = "💸 Расход" if item["type"] == "expense" else ("💰 Доход" if item["type"] == "income" else "🔄 Перевод")
                amt_val = float(item["amount"])
                amt_formatted = f"{amt_val:,.2f} ₽"
                acc_obj = acc_map.get(item.get("account_name")) or (accounts[0] if accounts else None)
                cat_obj = cat_map.get(item.get("category_name"))

                acc_icon = acc_obj.icon if acc_obj and getattr(acc_obj, "icon", None) else "💳"
                acc_title = acc_obj.name if acc_obj else (item.get("account_name") or "Основной")
                cat_icon = cat_obj.icon if cat_obj and getattr(cat_obj, "icon", None) else "📁"
                cat_title = cat_obj.name if cat_obj else (item.get("category_name") or "Без категории")

                lines = [
                    f"✅ {type_sym} записан:\n",
                    f"💵 Сумма: {amt_formatted}",
                    f"📁 Категория: {cat_icon} {cat_title}",
                    f"💳 Счёт: {acc_icon} {acc_title}",
                ]
                if item.get("note"):
                    lines.append(f"📝 Заметка: {item['note']}")
                if acc_obj:
                    bal_val = float(acc_obj.balance)
                    lines.append(f"\nОстаток на счете: {bal_val:,.2f} ₽")

                card_text = "\n".join(lines)
                buttons = [
                    [
                        InlineKeyboardButton(text="✏️ Редактировать", callback_data=f"confirm:{draft.id}"),
                        InlineKeyboardButton(text="❌ Отменить", callback_data=f"cancel:{draft.id}"),
                    ]
                ]
                if settings.WEBAPP_URL and settings.WEBAPP_URL.startswith("https://"):
                    buttons.append([
                        InlineKeyboardButton(text="📱 Открыть в приложении", web_app=WebAppInfo(url=settings.WEBAPP_URL))
                    ])
                keyboard = InlineKeyboardMarkup(inline_keyboard=buttons)
                await message.answer(card_text, reply_markup=keyboard)
    except HTTPException as exc:
        await message.answer(str(exc.detail))
    except ValueError as exc:
        await message.answer(str(exc)[:500])
    except Exception as exc:
        logger.error("Draft preparation failed: %s", exc, exc_info=True)
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
                text = "✅ Запись сохранена в бюджете." if changed else "Уже было сохранено."
                await callback.message.answer(text, reply_markup=app_keyboard())
            else:
                changed = await cancel_draft(db, callback.from_user.id, draft_id)
                text = "❌ Запись отменена." if changed else "Черновик уже обработан или недоступен."
                await callback.message.edit_text(text)
    except ValueError as exc:
        await callback.message.answer(str(exc)[:500])
    except Exception:
        logger.error("Draft confirmation failed")
        await callback.message.answer("Не удалось завершить действие. Попробуйте позже.")


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
