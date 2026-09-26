from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user_id
from app.schemas.finance import TransactionCreate, TransactionUpdate, TransactionResponse
from app.services.finance_svc import FinanceService

router = APIRouter()


async def response(db, user_id, tx):
    from app.services.finance_transactions import owned
    from app.models.models import Account, Category

    result = TransactionResponse.model_validate(tx)
    account = await owned(db, Account, user_id, tx.account_id, active=False)
    category = (
        await owned(db, Category, user_id, tx.category_id, active=False) if tx.category_id else None
    )
    result.currency = account.currency
    result.account_name = account.name
    result.category_name = category.name if category else None
    result.category_icon = category.icon if category else None
    return result


@router.get("", response_model=list[TransactionResponse])
async def list_transactions(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0, le=100000),
    month_offset: int | None = Query(None, ge=-120, le=120),
    currency: str | None = Query(None, pattern="^[A-Z]{3}$"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await FinanceService.list_transactions(
        db, user_id, limit, offset, month_offset, currency
    )


@router.post("", response_model=TransactionResponse)
async def create_transaction(
    payload: TransactionCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tx = await FinanceService.create_transaction(db, user_id, payload)
    return await response(db, user_id, tx)


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tx = await FinanceService.update_transaction(
        db, user_id, transaction_id, payload.model_dump(exclude_unset=True)
    )
    if tx is None:
        raise HTTPException(404, "Операция не найдена")
    return await response(db, user_id, tx)


@router.delete("/{transaction_id}")
async def delete_transaction(
    transaction_id: str,
    revision: int = Query(..., ge=1),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if not await FinanceService.delete_transaction(db, user_id, transaction_id, revision):
        raise HTTPException(404, "Операция не найдена")
    return {"status": "success", "deleted_id": transaction_id}
