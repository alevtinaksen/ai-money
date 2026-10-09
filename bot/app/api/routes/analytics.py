from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user_id
from app.schemas.finance import DashboardSummary
from app.services.finance_svc import FinanceService
from typing import Literal
from app.schemas.finance import CategoryAnalytics
from app.services.category_analytics import category_analytics

router = APIRouter()


@router.get("/dashboard", response_model=DashboardSummary)
async def get_dashboard(
    month_offset: int = Query(0, ge=-120, le=120),
    currency: str = Query("RUB", pattern="^[A-Z]{3}$"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await FinanceService.get_dashboard_summary(db, user_id, month_offset, currency)


@router.get("/categories/{category_id}", response_model=CategoryAnalytics)
async def get_category_analytics(
    category_id: str,
    month_offset: int = Query(0, ge=-120, le=120),
    currency: str = Query("RUB", pattern="^[A-Z]{3}$"),
    kind: Literal["expense", "income"] = "expense",
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0, le=100000),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await category_analytics(db, user_id, category_id, month_offset, currency, kind, limit, offset)
