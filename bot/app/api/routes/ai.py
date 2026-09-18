from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.core.database import get_db
from app.api.deps import get_current_user_id
from app.schemas.finance import AIParsedResult
from app.services.ai_parser import AIParserService
from app.services.finance_svc import FinanceService

router = APIRouter()

class TextParseRequest(BaseModel):
    text: str

@router.post("/parse-text", response_model=AIParsedResult)
async def parse_text(
    payload: TextParseRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    accounts = await FinanceService.get_accounts(db, user_id)
    categories = await FinanceService.get_categories(db, user_id)
    
    acc_names = [a.name for a in accounts]
    cat_names = [c.name for c in categories]

    return await AIParserService.parse_financial_text(payload.text, acc_names, cat_names)

@router.post("/parse-voice", response_model=AIParsedResult)
async def parse_voice(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    try:
        audio_bytes = await file.read()
        transcribed_text = await AIParserService.transcribe_audio(audio_bytes, file.filename or "voice.ogg")
        
        if not transcribed_text:
            raise HTTPException(status_code=400, detail="Не удалось распознать голос")

        accounts = await FinanceService.get_accounts(db, user_id)
        categories = await FinanceService.get_categories(db, user_id)
        acc_names = [a.name for a in accounts]
        cat_names = [c.name for c in categories]

        result = await AIParserService.parse_financial_text(transcribed_text, acc_names, cat_names)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
