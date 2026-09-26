"""Telegram bot notification utilities."""
import logging
from aiogram import Bot
from sqlalchemy import select, distinct
from app.core.database import AsyncSessionLocal
from app.models.models import Account
from app.bot.handlers.safe_flow import app_keyboard

logger = logging.getLogger(__name__)


async def notify_restart(bot: Bot):
    """Sends a restart/update notification to registered users."""
    try:
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(distinct(Account.user_id)))
            user_ids = [uid for uid in res.scalars().all() if uid and uid > 100000]

        text = "🚀 Бот перезапущен, обновление применено и он готов к работе!"
        kb = app_keyboard()
        for uid in user_ids:
            try:
                await bot.send_message(chat_id=uid, text=text, reply_markup=kb)
            except Exception as e:
                logger.debug(f"Could not send restart notice to {uid}: {e}")
    except Exception as e:
        logger.warning(f"Failed to send restart notification: {e}")
