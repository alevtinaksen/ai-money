"""SQL period aggregates, independent from recent transaction pagination."""

from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Account, Category, Transaction
from app.schemas.finance import TransactionResponse, DashboardSummary, CategoryStat


def period_bounds(month_offset: int) -> tuple[datetime, datetime]:
    if not -120 <= month_offset <= 120:
        raise ValueError("Период вне допустимого диапазона")
    now = datetime.now(timezone.utc)
    ordinal = now.year * 12 + now.month - 1 + month_offset
    year, month = divmod(ordinal, 12)
    next_year, next_month = divmod(ordinal + 1, 12)
    return datetime(year, month + 1, 1, tzinfo=timezone.utc), datetime(
        next_year, next_month + 1, 1, tzinfo=timezone.utc
    )


async def list_transactions(
    db: AsyncSession,
    user_id: int,
    limit: int = 50,
    offset: int = 0,
    month_offset: int | None = None,
    currency: str | None = None,
) -> list[TransactionResponse]:
    if not 1 <= limit <= 100 or not 0 <= offset <= 100000:
        raise ValueError("Некорректная страница")
    query = (
        select(Transaction, Account, Category)
        .join(Account, Transaction.account_id == Account.id)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Account.user_id == user_id,
            Transaction.is_deleted.is_(False),
        )
    )
    if month_offset is not None:
        start, end = period_bounds(month_offset)
        query = query.where(Transaction.created_at >= start, Transaction.created_at < end)
    if currency:
        query = query.where(Account.currency == currency)
    rows = (
        await db.execute(
            query.order_by(Transaction.created_at.desc(), Transaction.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    results = []
    for tx, account, category in rows:
        response = TransactionResponse.model_validate(tx)
        response.account_name = account.name
        response.currency = account.currency
        response.category_name = category.name if category else None
        response.category_icon = category.icon if category else None
        results.append(response)
    return results


async def get_dashboard_summary(
    db: AsyncSession, user_id: int, month_offset: int = 0, currency: str = "RUB"
) -> DashboardSummary:
    start, end = period_bounds(month_offset)
    # Archived accounts remain included: hiding a card does not destroy its money/history.
    balances = dict(
        (
            await db.execute(
                select(Account.currency, func.sum(Account.balance))
                .where(Account.user_id == user_id)
                .group_by(Account.currency)
            )
        ).all()
    )
    filters = (
        Transaction.user_id == user_id,
        Account.user_id == user_id,
        Transaction.is_deleted.is_(False),
        Transaction.created_at >= start,
        Transaction.created_at < end,
    )
    totals_query = (
        select(Account.currency, Transaction.type, func.sum(Transaction.amount))
        .join(Account, Transaction.account_id == Account.id)
        .where(*filters, Transaction.type != "transfer")
        .group_by(Account.currency, Transaction.type)
    )
    totals = {}
    for code, kind, amount in (await db.execute(totals_query)).all():
        totals.setdefault(code, {"income": 0.0, "expense": 0.0})[kind] = float(amount)
    selected = totals.get(currency, {"income": 0.0, "expense": 0.0})
    stats_query = (
        select(
            Category.id, Category.name, Category.icon, Category.color, func.sum(Transaction.amount)
        )
        .select_from(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(*filters, Account.currency == currency, Transaction.type == "expense")
        .group_by(Category.id, Category.name, Category.icon, Category.color)
    )
    stats = []
    for cid, name, icon, color, amount in (await db.execute(stats_query)).all():
        stats.append(
            CategoryStat(
                id=cid or "uncategorized",
                name=name or "Без категории",
                icon=icon or "📦",
                color=color or "#F3F4F6",
                total_amount=float(amount),
                percentage=round(float(amount) / selected["expense"] * 100, 1)
                if selected["expense"]
                else 0,
            )
        )
    return DashboardSummary(
        currency=currency,
        balances_by_currency={k: float(v) for k, v in balances.items()},
        totals_by_currency=totals,
        total_balance=float(balances.get(currency, 0)),
        period_label=start.strftime("%Y-%m"),
        period_income=selected["income"],
        period_expense=selected["expense"],
        categories=stats,
        recent_transactions=await list_transactions(db, user_id, limit=20),
    )
