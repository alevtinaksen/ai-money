from aiogram import Router, F, Bot
from aiogram.types import Message
from app.bot.handlers.common import handle_user_input

router = Router()

@router.message(F.text & ~F.text.startswith("/"))
async def handle_text_message(message: Message, bot: Bot):
    await handle_user_input(
        user_id=message.from_user.id,
        text=message.text,
        bot=bot,
        chat_id=message.chat.id
    )
