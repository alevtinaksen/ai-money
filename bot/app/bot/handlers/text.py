from aiogram import Router, F, Bot
from aiogram.types import Message
from app.bot.handlers.common import process_and_save_transactions

router = Router()

@router.message(F.text & ~F.text.startswith("/"))
async def handle_text_message(message: Message, bot: Bot):
    # Process financial text message
    await process_and_save_transactions(
        user_id=message.from_user.id,
        text=message.text,
        bot=bot,
        chat_id=message.chat.id
    )
