from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user_id
from app.schemas.finance import CategoryCreate, CategoryUpdate, CategoryResponse
from app.services.finance_svc import FinanceService as F

router = APIRouter()


@router.get("", response_model=list[CategoryResponse])
async def list_categories(
    user_id: int = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
):
    return await F.get_categories(db, user_id)


@router.post("", response_model=CategoryResponse)
async def create_category(
    payload: CategoryCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await F.create_category(db, user_id, payload)


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    payload: CategoryUpdate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    category = await F.update_category(
        db, user_id, category_id, payload.model_dump(exclude_unset=True)
    )
    if category is None:
        raise HTTPException(404, "Категория не найдена")
    return category


@router.delete("/{category_id}")
async def delete_category(
    category_id: str,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if not await F.delete_category(db, user_id, category_id):
        raise HTTPException(404, "Категория не найдена")
    return {"status": "ok"}
