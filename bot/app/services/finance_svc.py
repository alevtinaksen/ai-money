from typing import List, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, desc, func
from app.models.models import Account, Category, Transaction
from app.schemas.finance import (
    AccountCreate, AccountUpdate, CategoryCreate,
    TransactionCreate, DashboardSummary, CategoryStat,
    TransactionResponse
)

DEFAULT_ACCOUNTS = [
    {"name": "Наличные", "group_name": "Личное", "balance": 16000.00, "icon": "💵", "color": "#E3F2FD", "sort_order": 1},
    {"name": "Карта Альфа", "group_name": "Личное", "balance": 5522.16, "icon": "❤️", "color": "#FEE2E2", "is_default": True, "sort_order": 2},
    {"name": "Т-Банк", "group_name": "Личное", "balance": 6753.51, "icon": "💛", "color": "#FEF3C7", "sort_order": 3},
    {"name": "Озон Банк", "group_name": "Личное", "balance": 261.00, "icon": "💙", "color": "#E0F2FE", "sort_order": 4},
    {"name": "Накопительный счет", "group_name": "Личное", "balance": 534342.66, "icon": "👥", "color": "#E2E8F0", "sort_order": 5},
    {"name": "Брокерский счет", "group_name": "Личное", "balance": 43183.99, "icon": "🏺", "color": "#FDF2E9", "sort_order": 6},
    {"name": "Карта на еду", "group_name": "Общее", "balance": 20974.64, "icon": "💛", "color": "#FEF3C7", "sort_order": 7},
    {"name": "Подушка безопасности на еду", "group_name": "Общее", "balance": 44803.15, "icon": "🛏️", "color": "#F3F4F6", "sort_order": 8},
]

DEFAULT_CATEGORIES = [
    {"name": "Еда", "type": "expense", "icon": "🍔", "sort_order": 1},
    {"name": "Транспорт", "type": "expense", "icon": "🚗", "sort_order": 2},
    {"name": "Покупки", "type": "expense", "icon": "🛍️", "sort_order": 3},
    {"name": "Развлечения", "type": "expense", "icon": "🎬", "sort_order": 4},
    {"name": "Здоровье", "type": "expense", "icon": "💊", "sort_order": 5},
    {"name": "Подписки", "type": "expense", "icon": "💿", "sort_order": 6},
    {"name": "Самокат", "type": "expense", "icon": "🍔", "sort_order": 7},
    {"name": "Зарплата", "type": "income", "icon": "💰", "sort_order": 8},
    {"name": "Переводы", "type": "income", "icon": "💸", "sort_order": 9},
]

class FinanceService:
    @staticmethod
    async def ensure_user_seeded(db: AsyncSession, user_id: int):
        """Creates default accounts and categories for new user matching UI screenshots."""
        stmt = select(Account).where(Account.user_id == user_id)
        res = await db.execute(stmt)
        if res.first() is not None:
            return

        for acc in DEFAULT_ACCOUNTS:
            account = Account(user_id=user_id, **acc)
            db.add(account)

        for cat in DEFAULT_CATEGORIES:
            category = Category(user_id=user_id, **cat)
            db.add(category)

        await db.commit()

    @staticmethod
    async def get_accounts(db: AsyncSession, user_id: int) -> List[Account]:
        await FinanceService.ensure_user_seeded(db, user_id)
        stmt = select(Account).where(Account.user_id == user_id).order_by(Account.sort_order, Account.created_at)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def get_default_account(db: AsyncSession, user_id: int) -> Optional[Account]:
        accounts = await FinanceService.get_accounts(db, user_id)
        for acc in accounts:
            if acc.is_default:
                return acc
        return accounts[0] if accounts else None

    @staticmethod
    async def create_account(db: AsyncSession, user_id: int, data: AccountCreate) -> Account:
        acc = Account(user_id=user_id, **data.model_dump())
        db.add(acc)
        await db.commit()
        await db.refresh(acc)
        return acc

    @staticmethod
    async def get_categories(db: AsyncSession, user_id: int) -> List[Category]:
        await FinanceService.ensure_user_seeded(db, user_id)
        stmt = select(Category).where(Category.user_id == user_id).order_by(Category.sort_order, Category.created_at)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_transaction(db: AsyncSession, user_id: int, data: TransactionCreate) -> Transaction:
        # 1. Fetch account
        stmt = select(Account).where(Account.id == data.account_id, Account.user_id == user_id)
        res = await db.execute(stmt)
        account = res.scalar_one_or_none()
        if not account:
            raise ValueError("Счёт списания не найден")

        # 2. Update balances
        if data.type == "expense":
            account.balance = float(account.balance) - float(data.amount)
        elif data.type == "income":
            account.balance = float(account.balance) + float(data.amount)
        elif data.type == "transfer":
            if not data.to_account_id:
                raise ValueError("Для перевода необходимо указать счет зачисления")
            stmt_to = select(Account).where(Account.id == data.to_account_id, Account.user_id == user_id)
            res_to = await db.execute(stmt_to)
            to_account = res_to.scalar_one_or_none()
            if not to_account:
                raise ValueError("Счёт зачисления не найден")
            account.balance = float(account.balance) - float(data.amount)
            to_account.balance = float(to_account.balance) + float(data.amount)

        # 3. Create transaction record
        tx = Transaction(
            user_id=user_id,
            account_id=data.account_id,
            to_account_id=data.to_account_id,
            category_id=data.category_id,
            amount=data.amount,
            type=data.type,
            note=data.note,
            created_at=data.created_at or datetime.now(timezone.utc)
        )
        db.add(tx)
        await db.commit()
        await db.refresh(tx)
        return tx

    @staticmethod
    async def delete_transaction(db: AsyncSession, user_id: int, tx_id: str) -> bool:
        stmt = select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id)
        res = await db.execute(stmt)
        tx = res.scalar_one_or_none()
        if not tx:
            return False

        # Revert balances
        stmt_acc = select(Account).where(Account.id == tx.account_id)
        res_acc = await db.execute(stmt_acc)
        acc = res_acc.scalar_one_or_none()
        if acc:
            if tx.type == "expense":
                acc.balance = float(acc.balance) + float(tx.amount)
            elif tx.type == "income":
                acc.balance = float(acc.balance) - float(tx.amount)
            elif tx.type == "transfer" and tx.to_account_id:
                acc.balance = float(acc.balance) + float(tx.amount)
                stmt_to = select(Account).where(Account.id == tx.to_account_id)
                res_to = await db.execute(stmt_to)
                to_acc = res_to.scalar_one_or_none()
                if to_acc:
                    to_acc.balance = float(to_acc.balance) - float(tx.amount)

        await db.delete(tx)
        await db.commit()
        return True

    @staticmethod
    async def get_dashboard_summary(db: AsyncSession, user_id: int, month_offset: int = 0) -> DashboardSummary:
        accounts = await FinanceService.get_accounts(db, user_id)
        categories = await FinanceService.get_categories(db, user_id)
        
        total_balance = sum(float(a.balance) for a in accounts)

        # Query recent transactions
        stmt = select(Transaction).where(Transaction.user_id == user_id).order_by(desc(Transaction.created_at)).limit(20)
        res = await db.execute(stmt)
        tx_list = list(res.scalars().all())

        cat_map = {c.id: c for c in categories}
        acc_map = {a.id: a for a in accounts}

        tx_responses = []
        period_expense = 0.0
        period_income = 0.0
        cat_spending = {c.id: 0.0 for c in categories}

        for tx in tx_list:
            cat = cat_map.get(tx.category_id)
            acc = acc_map.get(tx.account_id)
            
            if tx.type == "expense":
                period_expense += float(tx.amount)
                if tx.category_id in cat_spending:
                    cat_spending[tx.category_id] += float(tx.amount)
            elif tx.type == "income":
                period_income += float(tx.amount)

            tx_responses.append(TransactionResponse(
                id=tx.id,
                user_id=tx.user_id,
                account_id=tx.account_id,
                to_account_id=tx.to_account_id,
                category_id=tx.category_id,
                amount=float(tx.amount),
                type=tx.type,
                note=tx.note,
                created_at=tx.created_at,
                account_name=acc.name if acc else "Счёт",
                category_name=cat.name if cat else "Без категории",
                category_icon=cat.icon if cat else "📦"
            ))

        category_stats = []
        for cat in categories:
            amt = cat_spending.get(cat.id, 0.0)
            pct = (amt / period_expense * 100) if period_expense > 0 else 0.0
            category_stats.append(CategoryStat(
                id=cat.id,
                name=cat.name,
                icon=cat.icon,
                color=cat.color,
                total_amount=amt,
                percentage=round(pct, 1)
            ))

        return DashboardSummary(
            total_balance=total_balance,
            period_label="Сентябрь 2026",
            period_income=period_income,
            period_expense=period_expense,
            categories=category_stats,
            recent_transactions=tx_responses
        )
