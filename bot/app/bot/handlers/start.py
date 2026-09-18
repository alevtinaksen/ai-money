from aiogram import Router
from aiogram.types import Message, MenuButtonWebApp, WebAppInfo
from aiogram.filters import CommandStart
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.finance_svc import FinanceService

router = Router()

@router.message(CommandStart())
async def cmd_start(message: Message):
    user_id = message.from_user.id
    name = message.from_user.first_name or "друг"

    # Seed default accounts and categories for user
    async with AsyncSessionLocal() as db:
        await FinanceService.ensure_user_seeded(db, user_id)

    # Set Menu Button to open Mini App
    try:
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
        "⚡ **Быстрый ввод расходов:**\n"
        "• Отправь **голосовое сообщение** (например: *«Кофе 250 с карты Альфа»*)\n"
        "• Или напиши **текстом** (например: *«Такси 450 и аптека 1200»*)\n\n"
        "📊 Нажми кнопку **«Бюджет»** внизу или используй Mini App для просмотра красивых дашбордов, счетов и аналитики!"
    )
    await message.answer(text, parse_mode="Markdown")
