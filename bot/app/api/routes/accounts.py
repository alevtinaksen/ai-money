from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user_id
from app.schemas.finance import AccountCreate, AccountUpdate, AccountResponse
from app.services.finance_svc import FinanceService

router = APIRouter()


@router.get("", response_model=List[AccountResponse])
async def list_accounts(
    include_archived: bool = False,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    accounts = await FinanceService.get_accounts(db, user_id, include_archived)
    return [AccountResponse.model_validate(a) for a in accounts]


@router.post("", response_model=AccountResponse)
async def create_account(
    payload: AccountCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    acc = await FinanceService.create_account(db, user_id, payload)
    return AccountResponse.model_validate(acc)


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: str,
    payload: AccountUpdate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    acc = await FinanceService.update_account(
        db, user_id, account_id, payload.model_dump(exclude_unset=True)
    )
    if not acc:
        raise HTTPException(status_code=404, detail="Счёт не найден")
    return AccountResponse.model_validate(acc)


@router.delete("/{account_id}")
async def delete_account(
    account_id: str, user_id: int = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
):
    success = await FinanceService.delete_account(db, user_id, account_id)
    if not success:
        raise HTTPException(status_code=404, detail="Счёт не найден")
    return {"status": "ok"}
