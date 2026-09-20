import logging
from aiogram import Router, F, Bot
from aiogram.types import Message
from app.bot.handlers.common import handle_user_input

logger = logging.getLogger(__name__)

router = Router()

@router.message(F.text & ~F.text.startswith("/"))
async def handle_text_message(message: Message, bot: Bot):
    try:
        await handle_user_input(
            user_id=message.from_user.id,
            text=message.text,
            bot=bot,
            chat_id=message.chat.id
        )
    except Exception as e:
        logger.error(f"Error processing text message: {e}", exc_info=True)
        await message.answer(f"⚠️ Произошла ошибка при обработке: {str(e)}")
