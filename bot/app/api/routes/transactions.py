from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user_id
from app.schemas.finance import TransactionCreate, TransactionUpdate, TransactionResponse
from app.services.finance_svc import FinanceService

import logging
logger = logging.getLogger(__name__)

from typing import List
from sqlalchemy import select, desc
from app.models.models import Transaction

router = APIRouter()

@router.get("", response_model=List[TransactionResponse])
async def list_transactions(
    limit: int = 50,
    offset: int = 0,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(desc(Transaction.created_at))
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(stmt)
    tx_list = res.scalars().all()

    accounts = await FinanceService.get_accounts(db, user_id)
    categories = await FinanceService.get_categories(db, user_id)
    acc_map = {a.id: a for a in accounts}
    cat_map = {c.id: c for c in categories}

    result = []
    for tx in tx_list:
        acc = acc_map.get(tx.account_id)
        cat = cat_map.get(tx.category_id)
        result.append(
            TransactionResponse(
                id=tx.id,
                user_id=tx.user_id,
                account_id=tx.account_id,
                to_account_id=tx.to_account_id,
                category_id=tx.category_id,
                amount=float(tx.amount),
                type=tx.type,
                note=tx.note,
                created_at=tx.created_at,
                account_name=acc.name if acc else None,
                category_name=cat.name if cat else None,
                category_icon=cat.icon if cat else None,
            )
        )
    return result

@router.post("", response_model=TransactionResponse)
async def create_transaction(
    payload: TransactionCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    try:
        tx = await FinanceService.create_transaction(db, user_id, payload)
        # Convert to response
        accounts = await FinanceService.get_accounts(db, user_id)
        categories = await FinanceService.get_categories(db, user_id)
        acc_map = {a.id: a for a in accounts}
        cat_map = {c.id: c for c in categories}
        acc = acc_map.get(tx.account_id)
        cat = cat_map.get(tx.category_id)

        return TransactionResponse(
            id=tx.id,
            user_id=tx.user_id,
            account_id=tx.account_id,
            to_account_id=tx.to_account_id,
            category_id=tx.category_id,
            amount=float(tx.amount),
            type=tx.type,
            note=tx.note,
            created_at=tx.created_at,
            account_name=acc.name if acc else None,
            category_name=cat.name if cat else None,
            category_icon=cat.icon if cat else None
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create transaction: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)}")


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    tx = await FinanceService.update_transaction(
        db, user_id, transaction_id, payload.model_dump(exclude_unset=True)
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Транзакция не найдена")

    accounts = await FinanceService.get_accounts(db, user_id)
    categories = await FinanceService.get_categories(db, user_id)
    acc_map = {a.id: a for a in accounts}
    cat_map = {c.id: c for c in categories}
    acc = acc_map.get(tx.account_id)
    cat = cat_map.get(tx.category_id)

    return TransactionResponse(
        id=tx.id,
        user_id=tx.user_id,
        account_id=tx.account_id,
        to_account_id=tx.to_account_id,
        category_id=tx.category_id,
        amount=float(tx.amount),
        type=tx.type,
        note=tx.note,
        created_at=tx.created_at,
        account_name=acc.name if acc else None,
        category_name=cat.name if cat else None,
        category_icon=cat.icon if cat else None
    )

@router.delete("/{transaction_id}")
async def delete_transaction(
    transaction_id: str,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    success = await FinanceService.delete_transaction(db, user_id, transaction_id)
    if not success:
        raise HTTPException(status_code=404, detail="Транзакция не найдена")
    return {"status": "success", "deleted_id": transaction_id}
