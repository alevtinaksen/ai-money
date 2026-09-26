"""HTTP application; Telegram polling is a separate single process."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user_id, issue_local_token
from app.api.routes import accounts, categories, transactions, analytics, ai, imports
from app.core.config import settings
from app.core.body_limit import BodyLimitMiddleware
from app.core.database import engine, get_db, init_db
from app.domain.errors import ConflictError
from app.services.finance_svc import FinanceService
from app.services import bot_drafts  # noqa: F401

import asyncio
from aiogram import Bot, Dispatcher
from app.bot.handlers.safe_flow import router as bot_router
from app.bot.notifier import notify_restart

VERSION = "2.0.0"
logger = logging.getLogger("ai-money")


async def poll_bot_forever(bot: Bot, dispatcher: Dispatcher):
    while True:
        try:
            await bot.delete_webhook(drop_pending_updates=True)
            await dispatcher.start_polling(bot, handle_as_tasks=False, drop_pending_updates=True)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Bot polling error: {e}, retrying in 3s...")
            await asyncio.sleep(3)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.ALLOW_LOCAL_LOGIN and (settings.APP_ENV != "development"
            or settings.HOST not in {"127.0.0.1", "localhost", "::1"}):
        raise RuntimeError("Local login requires development and loopback HOST")
    await init_db()

    bot_task = None
    bot_instance = None
    if settings.BOT_TOKEN and not settings.ALLOW_LOCAL_LOGIN:
        try:
            bot_instance = Bot(settings.BOT_TOKEN)
            dispatcher = Dispatcher()
            dispatcher.include_router(bot_router)
            asyncio.create_task(notify_restart(bot_instance))
            bot_task = asyncio.create_task(poll_bot_forever(bot_instance, dispatcher))
            logger.info("Telegram Bot polling started in lifespan")
        except Exception as e:
            logger.error(f"Failed to start bot polling: {e}")

    yield

    if bot_task:
        bot_task.cancel()
        if bot_instance:
            await bot_instance.session.close()
    await engine.dispose()


app = FastAPI(title="AI Money API", version=VERSION, lifespan=lifespan)
app.add_middleware(CORSMiddleware,
    allow_origins=list({"http://localhost:5173", "http://127.0.0.1:5173", settings.WEBAPP_URL}),
    allow_credentials=False, allow_methods=["GET","POST","PUT","PATCH","DELETE"],
    allow_headers=["Authorization","Content-Type"],
)


app.add_middleware(BodyLimitMiddleware, max_bytes=settings.MAX_UPLOAD_BYTES + 65536)


@app.middleware("http")
async def request_limits(request: Request, call_next):
    length = request.headers.get("content-length")
    if length:
        try:
            if int(length) < 0 or int(length) > settings.MAX_UPLOAD_BYTES + 65536:
                return JSONResponse({"detail":"Запрос слишком большой"}, 413)
        except ValueError:
            return JSONResponse({"detail":"Неверный Content-Length"}, 400)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response


def problem(status: int, detail: str):
    return JSONResponse(
        {"type":"about:blank", "title":"Запрос не выполнен", "status":status, "detail":detail},
        status_code=status, media_type="application/problem+json",
    )


@app.exception_handler(ConflictError)
async def conflict_handler(request, exc):
    return problem(409, str(exc))


@app.exception_handler(ValueError)
async def value_handler(request, exc):
    return problem(400, str(exc))


@app.exception_handler(RequestValidationError)
async def validation_handler(request, exc):
    # Never echo raw inputs, credentials, or bank rows in error responses/logs.
    return problem(422, "Проверьте обязательные поля, сумму, дату и формат запроса")


@app.exception_handler(Exception)
async def internal_handler(request, exc):
    logger.error("Request failed: %s", type(exc).__name__)
    return problem(500, "Действие не завершено. Обновите данные перед повтором.")


for module, name in [(accounts,"accounts"),(categories,"categories"),(transactions,"transactions"),
                     (analytics,"analytics"),(ai,"ai"),(imports,"imports")]:
    app.include_router(module.router, prefix=f"/api/{name}", tags=[name])


@app.post("/api/auth/local")
async def local_login(request: Request):
    return issue_local_token(request)


@app.post("/api/onboarding")
async def onboard(user_id: int = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    await FinanceService.ensure_user_seeded(db, user_id)
    return {"status":"ready"}


@app.get("/health/live")
@app.get("/health")
async def health():
    return {"status":"alive", "version":VERSION}


@app.get("/health/ready")
async def ready():
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(503, "Хранилище недоступно") from None
    return {"status":"ready", "version":VERSION}


@app.get("/api/version")
async def version():
    return {"version":VERSION}


dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if dist.is_dir():
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
