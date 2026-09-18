from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user_id
from app.schemas.finance import AccountCreate, AccountResponse
from app.services.finance_svc import FinanceService

router = APIRouter()

@router.get("", response_model=List[AccountResponse])
async def list_accounts(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    accounts = await FinanceService.get_accounts(db, user_id)
    return [AccountResponse.model_validate(a) for a in accounts]

@router.post("", response_model=AccountResponse)
async def create_account(
    payload: AccountCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    acc = await FinanceService.create_account(db, user_id, payload)
    return AccountResponse.model_validate(acc)
