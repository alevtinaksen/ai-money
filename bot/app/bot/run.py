"""Start exactly one Telegram polling process, separately from the HTTP API."""
import asyncio
from aiogram import Bot, Dispatcher
from app.core.config import settings
from app.core.database import engine, init_db
from app.bot.handlers.safe_flow import router


async def main():
    if not settings.BOT_TOKEN:
        raise SystemExit("Set BOT_TOKEN in bot/.env; never paste it in chat")
    await init_db()
    dispatcher = Dispatcher()
    dispatcher.include_router(router)
    async with Bot(settings.BOT_TOKEN) as bot:
        try:
            await bot.delete_webhook(drop_pending_updates=True)
            await dispatcher.start_polling(bot, handle_as_tasks=False, drop_pending_updates=True)
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
