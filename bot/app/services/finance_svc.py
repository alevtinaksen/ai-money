"""Finance facade; reads never initialize or restore user records."""

from decimal import Decimal
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.models.models import Account, Category, FinanceUser
from app.schemas.finance import AccountCreate, AccountUpdate, CategoryCreate, CategoryUpdate
from app.services.finance_transactions import (
    owned,
    create_transaction,
    update_transaction,
    delete_transaction,
)
from app.services.finance_analytics import get_dashboard_summary, list_transactions


def to_dec(value: Any) -> Decimal:
    result = Decimal(str(value))
    if (
        not result.is_finite()
        or abs(result) > Decimal("999999999999.99")
        or result != result.quantize(Decimal("0.01"))
    ):
        raise ValueError("Некорректная денежная сумма")
    return result


class FinanceService:
    create_transaction = staticmethod(create_transaction)
    update_transaction = staticmethod(update_transaction)
    delete_transaction = staticmethod(delete_transaction)
    get_dashboard_summary = staticmethod(get_dashboard_summary)
    list_transactions = staticmethod(list_transactions)

    @staticmethod
    async def ensure_user_seeded(db: AsyncSession, user_id: int) -> None:
        if await db.get(FinanceUser, user_id):
            return
        try:
            db.add(FinanceUser(user_id=user_id))
            await db.flush()
            db.add(Account(user_id=user_id, name="Основной счёт", balance=0, is_default=True))
            for name, kind in [
                ("Продукты", "expense"),
                ("Транспорт", "expense"),
                ("Прочее", "both"),
                ("Доход", "income"),
            ]:
                db.add(Category(user_id=user_id, name=name, type=kind))
            await db.commit()
        except IntegrityError:
            await db.rollback()
            if not await db.get(FinanceUser, user_id):
                raise

    @staticmethod
    async def get_accounts(
        db: AsyncSession, user_id: int, include_archived: bool = False
    ) -> list[Account]:
        query = select(Account).where(Account.user_id == user_id)
        if not include_archived:
            query = query.where(Account.is_archived.is_(False))
        return list(
            (
                await db.scalars(
                    query.order_by(Account.sort_order, Account.id).execution_options(
                        populate_existing=True
                    )
                )
            ).all()
        )

    @staticmethod
    async def get_default_account(db: AsyncSession, user_id: int) -> Account | None:
        accounts = await FinanceService.get_accounts(db, user_id)
        return next((a for a in accounts if a.is_default), accounts[0] if accounts else None)

    @staticmethod
    async def create_account(db: AsyncSession, user_id: int, data: AccountCreate) -> Account:
        data = AccountCreate.model_validate(data.model_dump())
        account = Account(user_id=user_id, **data.model_dump())
        db.add(account)
        await db.commit()
        await db.refresh(account)
        return account

    @staticmethod
    async def update_account(
        db: AsyncSession, user_id: int, account_id: str, data: dict[str, Any]
    ) -> Account | None:
        data = AccountUpdate(**data).model_dump(exclude_unset=True)
        account = await owned(db, Account, user_id, account_id)
        if account is None:
            return None
        for key, value in data.items():
            if value is None and key != "bank_name":
                raise ValueError("Поле не может быть пустым")
            setattr(account, key, value)
        await db.commit()
        await db.refresh(account)
        return account

    @staticmethod
    async def delete_account(db: AsyncSession, user_id: int, account_id: str) -> bool:
        account = await owned(db, Account, user_id, account_id)
        if account is None:
            return False
        account.is_archived = True
        await db.commit()
        return True

    @staticmethod
    async def get_categories(db: AsyncSession, user_id: int) -> list[Category]:
        return list(
            (
                await db.scalars(
                    select(Category)
                    .where(Category.user_id == user_id, Category.is_archived.is_(False))
                    .order_by(Category.sort_order, Category.id)
                )
            ).all()
        )

    @staticmethod
    async def create_category(db: AsyncSession, user_id: int, data: CategoryCreate) -> Category:
        data = CategoryCreate.model_validate(data.model_dump())
        if data.parent_id and not await owned(db, Category, user_id, data.parent_id):
            raise ValueError("Родительская категория не найдена")
        category = Category(user_id=user_id, **data.model_dump())
        db.add(category)
        await db.commit()
        await db.refresh(category)
        return category

    @staticmethod
    async def update_category(
        db: AsyncSession, user_id: int, category_id: str, data: dict[str, Any]
    ) -> Category | None:
        data = CategoryUpdate(**data).model_dump(exclude_unset=True)
        category = await owned(db, Category, user_id, category_id)
        if category is None:
            return None
        current = data.get("parent_id")
        seen = {category_id}
        while current:
            if current in seen:
                raise ValueError("Циклическая вложенность категорий")
            seen.add(current)
            parent = await owned(db, Category, user_id, current)
            if parent is None:
                raise ValueError("Родительская категория не найдена")
            current = parent.parent_id
        for key, value in data.items():
            if value is None and key not in ("parent_id", "budget_limit"):
                raise ValueError("Поле не может быть пустым")
            setattr(category, key, value)
        await db.commit()
        await db.refresh(category)
        return category

    @staticmethod
    async def delete_category(db: AsyncSession, user_id: int, category_id: str) -> bool:
        category = await owned(db, Category, user_id, category_id)
        if category is None:
            return False
        children = await db.scalar(
            select(Category.id).where(
                Category.parent_id == category_id, Category.is_archived.is_(False)
            )
        )
        if children:
            raise ValueError("Сначала перенесите или удалите подкатегории")
        category.is_archived = True
        await db.commit()
        return True

    @staticmethod
    async def get_user_sync_hash(db: AsyncSession, user_id: int) -> str:
        return ""
