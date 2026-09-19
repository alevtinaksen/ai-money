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
    # Личное (Альфа)
    {"name": "Карта Альфа (Основной)", "group_name": "Личное", "balance": 5851.50, "currency": "RUB", "icon": "❤️", "color": "#FEE2E2", "is_default": True, "sort_order": 1},
    {"name": "Альфа-Счёт (накопления)", "group_name": "Личное", "balance": 173060.04, "currency": "RUB", "icon": "📈", "color": "#E0F2FE", "is_default": False, "sort_order": 2},
    {"name": "Инвесткопилка (Альфа)", "group_name": "Личное", "balance": 66231.54, "currency": "RUB", "icon": "🪙", "color": "#FEF3C7", "is_default": False, "sort_order": 3},
    {"name": "Брокерский счёт (Альфа)", "group_name": "Личное", "balance": 51151.13, "currency": "RUB", "icon": "🏺", "color": "#FDF2E9", "is_default": False, "sort_order": 4},
    {"name": "Кредитная карта (Альфа)", "group_name": "Личное", "balance": 0.00, "currency": "RUB", "icon": "💳", "color": "#F3F4F6", "is_default": False, "sort_order": 5},

    # Личное (Т-Банк, Озон, Наличные)
    {"name": "Т-Банк Black", "group_name": "Личное", "balance": 0.00, "currency": "RUB", "icon": "💛", "color": "#FEF3C7", "is_default": False, "sort_order": 6},
    {"name": "Т-Банк USD", "group_name": "Личное", "balance": 100.00, "currency": "USD", "icon": "💵", "color": "#E3F2FD", "is_default": False, "sort_order": 7},
    {"name": "Т-Банк Инвестиции", "group_name": "Личное", "balance": 15980.39, "currency": "RUB", "icon": "📈", "color": "#EDE9FE", "is_default": False, "sort_order": 8},
    {"name": "Озон Банк", "group_name": "Личное", "balance": 2205.99, "currency": "RUB", "icon": "💙", "color": "#E0F2FE", "is_default": False, "sort_order": 9},
    {"name": "Наличные (Психотерапевт)", "group_name": "Личное", "balance": 10000.00, "currency": "RUB", "icon": "💵", "color": "#DCFCE7", "is_default": False, "sort_order": 10},

    # Общее (с Владом)
    {"name": "Влад и Алина - Едоки (Т-Банк)", "group_name": "Общее (с Владом)", "balance": 24759.86, "currency": "RUB", "icon": "👥", "color": "#FFEDD5", "is_default": False, "sort_order": 11},
    {"name": "Еда (подушка безопасности)", "group_name": "Общее (с Владом)", "balance": 46145.89, "currency": "RUB", "icon": "🛏️", "color": "#FEF3C7", "is_default": False, "sort_order": 12},
    {"name": "Совместный с Владом (Альфа)", "group_name": "Общее (с Владом)", "balance": 189.50, "currency": "RUB", "icon": "👥", "color": "#FEE2E2", "is_default": False, "sort_order": 13},

    # Кредиты и обязательства
    {"name": "Кредит наличными (Альфа)", "group_name": "Кредиты", "balance": 1290015.13, "currency": "RUB", "icon": "📑", "color": "#FEE2E2", "is_default": False, "sort_order": 20},
]

DEFAULT_CATEGORIES = [
    # Еда
    {"name": "Еда", "type": "expense", "icon": "🍔", "color": "#FEE2E2", "sort_order": 1},
    {"name": "Кафе", "type": "expense", "icon": "🍽️", "color": "#FEE2E2", "sort_order": 2},
    {"name": "Самокат", "type": "expense", "icon": "🛴", "color": "#FEE2E2", "sort_order": 3},
    {"name": "Кофе", "type": "expense", "icon": "☕", "color": "#FEE2E2", "sort_order": 4},
    {"name": "НаЛанч", "type": "expense", "icon": "🍱", "color": "#FEE2E2", "sort_order": 5},
    
    # Транспорт & Машина
    {"name": "Транспорт", "type": "expense", "icon": "🚗", "color": "#E0F2FE", "sort_order": 6},
    {"name": "Такси", "type": "expense", "icon": "🚕", "color": "#E0F2FE", "sort_order": 7},
    {"name": "Каршеринг", "type": "expense", "icon": "🚙", "color": "#E0F2FE", "sort_order": 8},
    {"name": "Общественный транспорт", "type": "expense", "icon": "🚌", "color": "#E0F2FE", "sort_order": 9},
    {"name": "Поезд", "type": "expense", "icon": "🚆", "color": "#E0F2FE", "sort_order": 10},
    {"name": "Машина", "type": "expense", "icon": "🚘", "color": "#DBEAFE", "sort_order": 11},
    {"name": "Бензин", "type": "expense", "icon": "⛽", "color": "#DBEAFE", "sort_order": 12},
    {"name": "ТО авто", "type": "expense", "icon": "🔧", "color": "#DBEAFE", "sort_order": 13},
    {"name": "Парковка", "type": "expense", "icon": "🅿️", "color": "#DBEAFE", "sort_order": 14},
    {"name": "Кредит за авто", "type": "expense", "icon": "📑", "color": "#DBEAFE", "sort_order": 15},

    # Покупки
    {"name": "Покупки", "type": "expense", "icon": "🛍️", "color": "#FCE7F3", "sort_order": 16},
    {"name": "Одежда", "type": "expense", "icon": "👗", "color": "#FCE7F3", "sort_order": 17},
    {"name": "Электроника", "type": "expense", "icon": "💻", "color": "#FCE7F3", "sort_order": 18},
    {"name": "Бытовая химия", "type": "expense", "icon": "🧼", "color": "#FCE7F3", "sort_order": 19},
    {"name": "Товары для хобби", "type": "expense", "icon": "🎨", "color": "#FCE7F3", "sort_order": 20},

    # Развлечения
    {"name": "Развлечения", "type": "expense", "icon": "🎬", "color": "#EDE9FE", "sort_order": 21},
    {"name": "Кино", "type": "expense", "icon": "🍿", "color": "#EDE9FE", "sort_order": 22},
    {"name": "Игры", "type": "expense", "icon": "🎮", "color": "#EDE9FE", "sort_order": 23},
    {"name": "Вечеринки", "type": "expense", "icon": "🎉", "color": "#EDE9FE", "sort_order": 24},

    # Здоровье
    {"name": "Здоровье", "type": "expense", "icon": "💊", "color": "#FEF3C7", "sort_order": 25},
    {"name": "Лекарства", "type": "expense", "icon": "💊", "color": "#FEF3C7", "sort_order": 26},
    {"name": "Врачи", "type": "expense", "icon": "🩺", "color": "#FEF3C7", "sort_order": 27},
    {"name": "Психотерапевт", "type": "expense", "icon": "🧠", "color": "#DCFCE7", "sort_order": 28},

    # Жилье
    {"name": "Жилье", "type": "expense", "icon": "🏠", "color": "#E0E7FF", "sort_order": 29},
    {"name": "Аренда", "type": "expense", "icon": "🔑", "color": "#E0E7FF", "sort_order": 30},
    {"name": "ЖКХ", "type": "expense", "icon": "💡", "color": "#E0E7FF", "sort_order": 31},
    {"name": "Ремонт", "type": "expense", "icon": "🔨", "color": "#E0E7FF", "sort_order": 32},

    # Личное & Кот
    {"name": "Личное", "type": "expense", "icon": "✨", "color": "#FEE2E2", "sort_order": 33},
    {"name": "Внешний вид", "type": "expense", "icon": "💄", "color": "#FEE2E2", "sort_order": 34},
    {"name": "Привычки", "type": "expense", "icon": "☕", "color": "#FEE2E2", "sort_order": 35},
    {"name": "Спорт", "type": "expense", "icon": "🏃", "color": "#FEE2E2", "sort_order": 36},
    {"name": "Кот", "type": "expense", "icon": "🐱", "color": "#FFEDD5", "sort_order": 37},
    {"name": "Корм для кота", "type": "expense", "icon": "🐟", "color": "#FFEDD5", "sort_order": 38},
    {"name": "Здоровье кота", "type": "expense", "icon": "🐾", "color": "#FFEDD5", "sort_order": 39},
    {"name": "Путешествия", "type": "expense", "icon": "✈️", "color": "#E0F2FE", "sort_order": 40},
    {"name": "Подписки", "type": "expense", "icon": "💿", "color": "#F3F4F6", "sort_order": 41},

    # Двусторонние / Доходы
    {"name": "Подарки", "type": "expense", "icon": "🎁", "color": "#FCE7F3", "sort_order": 42},
    {"name": "Подарки (получено)", "type": "income", "icon": "🎁", "color": "#DCFCE7", "sort_order": 43},
    {"name": "Переводы", "type": "expense", "icon": "💸", "color": "#E0F2FE", "sort_order": 44},
    {"name": "Переводы (получено)", "type": "income", "icon": "💸", "color": "#DCFCE7", "sort_order": 45},
    {"name": "Накопления", "type": "expense", "icon": "🏦", "color": "#FEF3C7", "sort_order": 46},
    {"name": "Зарплата", "type": "income", "icon": "💰", "color": "#DCFCE7", "sort_order": 47},
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
    async def update_transaction(db: AsyncSession, user_id: int, tx_id: str, data: dict) -> Optional[Transaction]:
        stmt = select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id)
        res = await db.execute(stmt)
        tx = res.scalar_one_or_none()
        if not tx:
            return None

        # Revert old balance
        stmt_acc = select(Account).where(Account.id == tx.account_id)
        res_acc = await db.execute(stmt_acc)
        old_acc = res_acc.scalar_one_or_none()
        if old_acc:
            if tx.type == "expense":
                old_acc.balance = float(old_acc.balance) + float(tx.amount)
            elif tx.type == "income":
                old_acc.balance = float(old_acc.balance) - float(tx.amount)
            elif tx.type == "transfer" and tx.to_account_id:
                old_acc.balance = float(old_acc.balance) + float(tx.amount)
                stmt_to = select(Account).where(Account.id == tx.to_account_id)
                res_to = await db.execute(stmt_to)
                old_to_acc = res_to.scalar_one_or_none()
                if old_to_acc:
                    old_to_acc.balance = float(old_to_acc.balance) - float(tx.amount)

        # Apply new fields
        new_account_id = data.get("account_id") or tx.account_id
        new_to_account_id = data.get("to_account_id", tx.to_account_id)
        new_amount = float(data.get("amount") if data.get("amount") is not None else tx.amount)
        new_type = data.get("type") or tx.type

        # Apply new balance
        stmt_new_acc = select(Account).where(Account.id == new_account_id)
        res_new_acc = await db.execute(stmt_new_acc)
        new_acc = res_new_acc.scalar_one_or_none()
        if new_acc:
            if new_type == "expense":
                new_acc.balance = float(new_acc.balance) - new_amount
            elif new_type == "income":
                new_acc.balance = float(new_acc.balance) + new_amount
            elif new_type == "transfer" and new_to_account_id:
                new_acc.balance = float(new_acc.balance) - new_amount
                stmt_new_to = select(Account).where(Account.id == new_to_account_id)
                res_new_to = await db.execute(stmt_new_to)
                new_to_acc = res_new_to.scalar_one_or_none()
                if new_to_acc:
                    new_to_acc.balance = float(new_to_acc.balance) + new_amount

        tx.account_id = new_account_id
        tx.to_account_id = new_to_account_id
        tx.amount = new_amount
        tx.type = new_type
        if "category_id" in data:
            tx.category_id = data["category_id"]
        if "note" in data:
            tx.note = data["note"]
        if "created_at" in data and data["created_at"]:
            tx.created_at = data["created_at"]

        await db.commit()
        await db.refresh(tx)
        return tx

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

    @staticmethod
    async def get_user_sync_hash(db: AsyncSession, user_id: int) -> str:
        import json
        import base64
        accounts = await FinanceService.get_accounts(db, user_id)
        balances = {a.name: float(a.balance) for a in accounts}

        stmt = select(Transaction).where(Transaction.user_id == user_id).order_by(desc(Transaction.created_at)).limit(50)
        res = await db.execute(stmt)
        txs = res.scalars().all()

        acc_dict = {a.id: a for a in accounts}
        categories = await FinanceService.get_categories(db, user_id)
        cat_dict = {c.id: c for c in categories}

        recent = []
        for t in txs:
            acc = acc_dict.get(t.account_id)
            cat = cat_dict.get(t.category_id)
            recent.append({
                "id": t.id,
                "user_id": t.user_id,
                "account_id": t.account_id,
                "category_id": t.category_id,
                "amount": float(t.amount),
                "type": t.type,
                "note": t.note or (cat.name if cat else "Трата"),
                "category_name": cat.name if cat else "Без категории",
                "category_icon": cat.icon if cat else "📦",
                "account_name": acc.name if acc else "Счёт",
                "created_at": t.created_at.isoformat() if t.created_at else ""
            })

        payload = {
            "balances": balances,
            "accounts": [
                {
                    "id": a.id,
                    "user_id": a.user_id,
                    "name": a.name,
                    "group_name": a.group_name,
                    "balance": float(a.balance),
                    "currency": a.currency,
                    "icon": a.icon,
                    "color": a.color,
                    "is_default": a.is_default,
                    "sort_order": a.sort_order,
                }
                for a in accounts
            ],
            "recent_transactions": recent
        }
        json_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        b64_str = base64.urlsafe_b64encode(json_bytes).decode("ascii")
        return f"#sync={b64_str}"

