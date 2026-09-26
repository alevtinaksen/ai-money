"""Authenticated bounded preview endpoints; no financial mutations."""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_user_id
from app.schemas.finance import AIParsedResult
from app.services.ai_parser import AIParserService
from app.services.finance_svc import FinanceService
from app.services.preview_budget import consume_preview

router = APIRouter()


class TextParseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)


async def context(db, user_id):
    accounts = await FinanceService.get_accounts(db, user_id)
    categories = await FinanceService.get_categories(db, user_id)
    return [a.name for a in accounts], [c.name for c in categories]


@router.post("/text", response_model=AIParsedResult)
@router.post("/parse-text", response_model=AIParsedResult)
async def parse_text(payload: TextParseRequest, user_id: int = Depends(get_current_user_id),
                     db: AsyncSession = Depends(get_db)):
    consume_preview(user_id)
    accounts, categories = await context(db, user_id)
    return await AIParserService.parse_financial_text(payload.text, accounts, categories)


@router.post("/parse-voice", response_model=AIParsedResult)
@router.post("/parse-receipt", response_model=AIParsedResult)
async def parse_media(file: UploadFile = File(...), user_id: int = Depends(get_current_user_id),
                      db: AsyncSession = Depends(get_db)):
    allowed = {"audio/ogg","audio/mpeg","audio/wav","audio/mp4","image/jpeg","image/png","image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(415, "Поддерживаются аудио OGG/MP3/WAV/M4A и изображения JPEG/PNG/WebP")
    try:
        data = await file.read(settings.MAX_UPLOAD_BYTES + 1)
    finally:
        await file.close()
    if len(data) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Максимальный размер файла — 5 МБ")
    consume_preview(user_id)
    accounts, categories = await context(db, user_id)
    return await AIParserService.parse_media(data, file.content_type, accounts, categories)
