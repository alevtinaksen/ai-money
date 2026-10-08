"""Complete category totals and paginated history for one owner's month."""
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Account, Category, Transaction
from app.schemas.finance import CategoryAnalytics, CategoryStat
from app.services.finance_analytics import list_transactions, period_bounds


async def category_analytics(
    db: AsyncSession, user_id: int, category_id: str, month_offset: int,
    currency: str, kind: str, limit: int = 50, offset: int = 0,
) -> CategoryAnalytics:
    categories = (await db.scalars(select(Category).where(Category.user_id == user_id))).all()
    by_id = {cat.id: cat for cat in categories}
    if category_id != "uncategorized" and category_id not in by_id:
        raise ValueError("Категория не найдена")
    selected_ids = {category_id} if category_id != "uncategorized" else set()
    while True:
        descendants = {cat.id for cat in categories if cat.parent_id in selected_ids}
        if descendants <= selected_ids:
            break
        selected_ids |= descendants
    ids = list(selected_ids) if selected_ids else [None]
    start, end = period_bounds(month_offset)
    query = (
        select(Transaction.category_id, func.sum(Transaction.amount), func.count(Transaction.id))
        .join(Account, Transaction.account_id == Account.id)
        .where(Transaction.user_id == user_id, Account.user_id == user_id,
               Account.currency == currency, Transaction.type == kind,
               Transaction.is_deleted.is_(False), Transaction.created_at >= start,
               Transaction.created_at < end,
               Transaction.category_id.in_(ids) if selected_ids else Transaction.category_id.is_(None))
        .group_by(Transaction.category_id)
    )
    rows = (await db.execute(query)).all()
    total = sum((amount for _, amount, _ in rows), 0)
    # Each operation belongs to exactly one category; never infer links from notes.
    stats = []
    for cid, amount, _ in rows:
        cat = by_id.get(cid)
        stats.append(CategoryStat(id=cid or "uncategorized", name=cat.name if cat else "Без категории",
                                  icon=cat.icon if cat else "📦", color=cat.color if cat else "#F3F4F6",
                                  total_amount=float(amount), percentage=round(float(amount / total * 100), 1) if total else 0))
    return CategoryAnalytics(
        category_id=category_id, period_label=start.strftime("%Y-%m"), currency=currency,
        kind=kind, total_amount=float(total), transaction_count=sum(count for _, _, count in rows),
        breakdown=sorted(stats, key=lambda stat: stat.total_amount, reverse=True),
        transactions=await list_transactions(db, user_id, limit, offset, month_offset, currency,
                                             category_ids=ids, kind=kind, period=(start, end)),
    )
