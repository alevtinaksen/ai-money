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

async def poll_bot_forever(bot_instance: Bot, dispatcher: Dispatcher):
    """Supervisor loop that keeps Telegram polling alive and reconnects on drops/conflicts."""
    while True:
        try:
            logger.info("Starting Telegram Bot polling...")
            await dispatcher.start_polling(bot_instance, handle_signals=False)
        except asyncio.CancelledError:
            logger.info("Telegram Bot polling task cancelled.")
            break
        except Exception as e:
            logger.error(f"Telegram Bot polling error: {e}. Reconnecting in 5 seconds...", exc_info=True)
            await asyncio.sleep(5)

async def keepalive_loop():
    """Ping our own /health endpoint every 10 minutes so Render free tier doesn't spin down."""
    import httpx
    await asyncio.sleep(60)  # wait for server to fully start
    while True:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"http://localhost:{settings.PORT}/health", timeout=10)
                logger.info(f"Keepalive ping: {resp.status_code}")
        except Exception as e:
            logger.warning(f"Keepalive ping failed: {e}")
        await asyncio.sleep(600)  # 10 minutes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup: initialize database tables
    logger.info("Initializing database...")
    await init_db()

    # 2. Start Bot Polling with supervisor loop if real token provided
    bot_task = None
    if bot:
        logger.info("Starting Telegram Bot polling supervisor in background...")
        bot_task = asyncio.create_task(poll_bot_forever(bot, dp))
    else:
        logger.warning("BOT_TOKEN is not configured or is default mock token. Telegram Bot polling skipped.")

    # 3. Start keepalive loop (prevents Render free tier from sleeping)
    keepalive_task = asyncio.create_task(keepalive_loop())

    yield

    # 4. Shutdown
    keepalive_task.cancel()
    if bot_task:
        bot_task.cancel()
        if bot:
            await bot.session.close()

app = FastAPI(
    title="AI Money API",
    description="Backend API for Telegram Mini App and AI Finance Bot",
    version="1.0.4",
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
    return {"status": "ok", "app": "AI Money", "version": "1.0.4"}

@app.get("/version")
@app.get("/api/version")
async def get_version():
    return {"version": "1.0.4", "status": "ok"}

# Mount frontend Mini App build
import os
from fastapi.staticfiles import StaticFiles

dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
