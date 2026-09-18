from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user_id
from app.schemas.finance import CategoryResponse
from app.services.finance_svc import FinanceService

router = APIRouter()

@router.get("", response_model=List[CategoryResponse])
async def list_categories(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    categories = await FinanceService.get_categories(db, user_id)
    return [CategoryResponse.model_validate(c) for c in categories]
