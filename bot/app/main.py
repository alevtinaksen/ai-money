import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from aiogram import Bot, Dispatcher
from app.core.config import settings
from app.core.database import init_db
from app.api.routes import accounts, categories, transactions, analytics, ai
from app.bot.handlers import start, voice, text, callbacks, receipt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-money")

# Initialize Aiogram
bot = Bot(token=settings.BOT_TOKEN) if settings.BOT_TOKEN and not settings.BOT_TOKEN.startswith("123456") else None
dp = Dispatcher()

# Register bot handlers
dp.include_router(start.router)
dp.include_router(voice.router)
dp.include_router(receipt.router)
dp.include_router(callbacks.router)
dp.include_router(text.router)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup: initialize database tables
    logger.info("Initializing database...")
    await init_db()

    # 2. Start Bot Polling if real token provided
    bot_task = None
    if bot:
        logger.info("Starting Telegram Bot polling in background...")
        bot_task = asyncio.create_task(dp.start_polling(bot))
    else:
        logger.warning("BOT_TOKEN is not configured or is default mock token. Telegram Bot polling skipped.")

    yield

    # 3. Shutdown
    if bot_task:
        bot_task.cancel()
        if bot:
            await bot.session.close()

app = FastAPI(
    title="AI Money API",
    description="Backend API for Telegram Mini App and AI Finance Bot",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Mini App web requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount REST API routers
app.include_router(accounts.router, prefix="/api/accounts", tags=["Accounts"])
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["Transactions"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])

@app.get("/health")
async def health():
    return {"status": "ok", "app": "AI Money"}

# Mount frontend Mini App build
import os
from fastapi.staticfiles import StaticFiles

dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
