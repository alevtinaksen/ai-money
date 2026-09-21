from decimal import Decimal
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

def to_dec(val) -> Decimal:
    if val is None:
        return Decimal("0.00")
    if isinstance(val, Decimal):
        return val
    try:
        return Decimal(str(round(float(val), 2)))
    except Exception:
        return Decimal("0.00")


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
        """Creates default accounts, categories and initial transactions for user matching UI."""
        stmt = select(Account).where(Account.user_id == user_id)
        res = await db.execute(stmt)
        accounts_exist = res.first() is not None

        if not accounts_exist:
            for acc in DEFAULT_ACCOUNTS:
                account = Account(user_id=user_id, **acc)
                db.add(account)

            for cat in DEFAULT_CATEGORIES:
                category = Category(user_id=user_id, **cat)
                db.add(category)

            await db.commit()

        # Check and seed transactions if missing
        stmt_tx = select(Transaction).where(Transaction.user_id == user_id)
        res_tx = await db.execute(stmt_tx)
        existing_txs = res_tx.scalars().all()
        existing_tx_ids = {t.id for t in existing_txs}

        # Load accounts and categories map for seeding
        acc_stmt = select(Account).where(Account.user_id == user_id)
        acc_res = await db.execute(acc_stmt)
        all_accs = acc_res.scalars().all()

        cat_stmt = select(Category).where(Category.user_id == user_id)
        cat_res = await db.execute(cat_stmt)
        all_cats = cat_res.scalars().all()

        def find_acc_id(name_hint: Optional[str]) -> Optional[str]:
            if not name_hint or not all_accs:
                return all_accs[0].id if all_accs else None
            h = name_hint.lower()
            for a in all_accs:
                an = a.name.lower()
                if an == h:
                    return a.id
                if 'едок' in h and 'едок' in an:
                    return a.id
                if 'озон' in h and 'озон' in an:
                    return a.id
                if ('основной' in h or 'карта альфа' in h) and ('основн' in an or 'карта альфа' in an):
                    return a.id
                if 'накоплен' in h and ('накопительн' in an or 'альфа-счёт' in an):
                    return a.id
                if 'инвесткопилка' in h and 'инвесткопилка' in an:
                    return a.id
            for a in all_accs:
                if a.name.lower() in h or h in a.name.lower():
                    return a.id
            return all_accs[0].id

        def find_cat_id(cat_name: Optional[str]) -> Optional[str]:
            if not cat_name or not all_cats:
                return all_cats[0].id if all_cats else None
            cn = cat_name.lower()
            for c in all_cats:
                if c.name.lower() == cn or cn in c.name.lower():
                    return c.id
            return all_cats[0].id

        raw_defaults = [
            {"id": "6548b97b-5fe1-4722-810b-c3a50126dec3", "amount": 8000.0, "type": "expense", "note": "OZON", "created_at": "2026-09-20T13:05:39.447695Z", "account_name": "Озон Банк", "category_name": "Покупки"},
            {"id": "12a62be3-3a1a-40f2-bd4c-3bd01727ef6e", "amount": 17600.0, "type": "expense", "note": "A", "created_at": "2026-09-20T13:05:39.444234Z", "account_name": "Озон Банк", "category_name": "Еда"},
            {"id": "0b0a01e9-78b4-404a-b8cc-9bf3c8fc7e59", "amount": 17600.0, "type": "expense", "note": "Владислав С.", "created_at": "2026-09-20T13:05:38.797537Z", "account_name": "Влад и Алина - Едоки (Т-Банк)", "category_name": "Еда"},
            {"id": "f2630213-5bf0-4ad6-b026-f1b1ca2cea84", "amount": 17900.0, "type": "expense", "note": "T", "created_at": "2026-09-20T13:05:38.796023Z", "account_name": "Влад и Алина - Едоки (Т-Банк)", "category_name": "Еда"},
            {"id": "4b418914-e868-4e31-ad9d-b78e6916c633", "amount": 3005.81, "type": "expense", "note": "Пятёрочка", "created_at": "2026-09-20T13:05:38.793595Z", "account_name": "Влад и Алина - Едоки (Т-Банк)", "category_name": "Еда"},
            {"id": "82593bee-92fd-4e84-a215-6de59d6773de", "amount": 7896.0, "type": "expense", "note": "Покупка озон банка для машины то", "created_at": "2026-09-20T09:30:14.864734Z", "account_name": "Озон Банк", "category_name": "Покупки"},
            {"id": "95fbcffa-0f94-46d4-9f3d-77d7c94336c4", "amount": 8.0, "type": "transfer", "note": "Перевод между счетами", "created_at": "2026-09-20T09:17:45.356167Z", "account_name": "Озон Банк", "to_account_name": "Карта Альфа (Основной)", "category_name": "Переводы"},
            {"id": "f5cd9a1a-f16b-43e4-9bbd-16ca7b86c7cc", "amount": 690.0, "type": "expense", "note": "1-st. FOOD FACTORY", "created_at": "2026-09-19T23:12:02Z", "account_name": "Влад и Алина - Едоки (Т-Банк)", "category_name": "Кафе"},
            {"id": "7b5eb7e4-4e92-47ed-9c6f-e623b4b60791", "amount": 109.99, "type": "expense", "note": "О'КЕЙ", "created_at": "2026-09-19T23:12:01Z", "account_name": "Влад и Алина - Едоки (Т-Банк)", "category_name": "Еда"},
            {"id": "98c8a90e-d6a4-46d2-853a-c96898a0f481", "amount": 498.0, "type": "expense", "note": "Вкусно — и точка", "created_at": "2026-09-19T23:12:00Z", "account_name": "Влад и Алина - Едоки (Т-Банк)", "category_name": "Кафе"},
            {"id": "3782a1ad-af1b-4ab7-a75b-3b305a3273be", "amount": 571.0, "type": "expense", "note": "Ozon bank +", "created_at": "2026-09-19T20:45:44.452303Z", "account_name": "Озон Банк", "category_name": "ТО авто"},
            {"id": "7d462fd8-5776-444f-826b-2c9cee5ad7d5", "amount": 15.0, "type": "transfer", "note": "Накопления с покупки", "created_at": "2026-09-19T20:11:30.867045Z", "account_name": "Карта Альфа (Основной)", "to_account_name": "Инвесткопилка (Альфа)", "category_name": "Накопления"},
            {"id": "0cd15549-4544-43da-a1b2-5733109094ed", "amount": 37.0, "type": "transfer", "note": "Накопления с покупки", "created_at": "2026-09-19T20:11:19.194399Z", "account_name": "Карта Альфа (Основной)", "to_account_name": "Инвесткопилка (Альфа)", "category_name": "Накопления"},
            {"id": "24e650ea-a356-40bc-923b-8b3428ce2fac", "amount": 504.0, "type": "income", "note": "Перевод от подруги", "created_at": "2026-09-19T20:10:33.809860Z", "account_name": "Карта Альфа (Основной)", "category_name": "Переводы (получено)"},
            {"id": "b6e5054c-f337-474d-942f-d393c3462883", "amount": 500.0, "type": "income", "note": "Перевод от подруги", "created_at": "2026-09-19T20:10:24.192153Z", "account_name": "Карта Альфа (Основной)", "category_name": "Переводы (получено)"},
            {"id": "76050f1e-c711-41fd-a31d-c7f8f8b1d71c", "amount": 285.0, "type": "expense", "note": "Dream kids (кофе)", "created_at": "2026-09-19T20:10:02.104868Z", "account_name": "Карта Альфа (Основной)", "category_name": "Кофе"},
            {"id": "01deadbf-4fda-49ff-8768-07c0834937ed", "amount": 1863.0, "type": "expense", "note": "Теремок", "created_at": "2026-09-19T20:09:06.247691Z", "account_name": "Карта Альфа (Основной)", "category_name": "Кафе"},
            {"id": "89966dde-b03d-47c7-9eca-b160717d5a4d", "amount": 5000.0, "type": "transfer", "note": "Перевод между счетами", "created_at": "2026-09-19T20:08:01.882952Z", "account_name": "Карта Альфа (Основной)", "to_account_name": "Альфа-Счёт (накопления)", "category_name": "Переводы"},
            {"id": "09e63854-af0e-4e18-8ee1-1210dcc57e27", "amount": 2074.0, "type": "expense", "note": "В самокате альфа-банка", "created_at": "2026-09-18T16:26:05.086903Z", "account_name": "Карта Альфа (Основной)", "category_name": "Самокат"},
            {"id": "5ef7015e-fedf-4e8b-a211-24957c97ecf4", "amount": 1104.0, "type": "expense", "note": "Озон еще списал за покупку 1104+1104+137", "created_at": "2026-09-18T15:29:49.428883Z", "account_name": "Карта Альфа (Основной)", "category_name": "Личное"},
            {"id": "4aa867e2-a35b-47ff-a8ad-85434bc0332b", "amount": 1000.0, "type": "transfer", "note": "Перевод между счетами", "created_at": "2026-09-18T15:18:47.856073Z", "account_name": "Карта Альфа (Основной)", "to_account_name": "Озон Банк", "category_name": "Переводы"},
            {"id": "35ab9e89-ae9c-410d-b4de-59142271f542", "amount": 2100.0, "type": "expense", "note": "Маникюр картой альфа-банка", "created_at": "2026-09-18T12:21:13.025686Z", "account_name": "Карта Альфа (Основной)", "category_name": "Личное"}
        ]

        added_any = False
        for rd in raw_defaults:
            if rd["id"] in existing_tx_ids:
                continue
            acc_id = find_acc_id(rd.get("account_name"))
            to_acc_id = find_acc_id(rd.get("to_account_name")) if rd.get("type") == "transfer" else None
            cat_id = find_cat_id(rd.get("category_name"))
            
            c_at = datetime.now(timezone.utc)
            if rd.get("created_at"):
                try:
                    c_at = datetime.fromisoformat(rd["created_at"].replace("Z", "+00:00"))
                except Exception:
                    pass

            t_obj = Transaction(
                id=rd["id"],
                user_id=user_id,
                account_id=acc_id,
                to_account_id=to_acc_id,
                category_id=cat_id,
                amount=to_dec(rd["amount"]),
                type=rd["type"],
                note=rd.get("note"),
                created_at=c_at
            )
            db.add(t_obj)
            added_any = True

        if added_any:
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
    async def update_account(db: AsyncSession, user_id: int, account_id: str, data: dict) -> Optional[Account]:
        stmt = select(Account).where(Account.id == account_id, Account.user_id == user_id)
        res = await db.execute(stmt)
        acc = res.scalar_one_or_none()
        if not acc:
            return None

        for key, val in data.items():
            if val is not None and hasattr(acc, key):
                if key == "balance":
                    val = to_dec(val)
                setattr(acc, key, val)

        await db.commit()
        await db.refresh(acc)
        return acc

    @staticmethod
    async def delete_account(db: AsyncSession, user_id: int, account_id: str) -> bool:
        stmt = select(Account).where(Account.id == account_id, Account.user_id == user_id)
        res = await db.execute(stmt)
        acc = res.scalar_one_or_none()
        if not acc:
            return False

        await db.delete(acc)
        await db.commit()
        return True

    @staticmethod
    async def get_categories(db: AsyncSession, user_id: int) -> List[Category]:
        await FinanceService.ensure_user_seeded(db, user_id)
        stmt = select(Category).where(Category.user_id == user_id).order_by(Category.sort_order, Category.created_at)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_transaction(db: AsyncSession, user_id: int, data: TransactionCreate) -> Transaction:
        # 0. Idempotency: if client_id already exists, return the existing transaction
        if data.client_id:
            stmt_check = select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.client_id == data.client_id
            )
            res_check = await db.execute(stmt_check)
            existing = res_check.scalar_one_or_none()
            if existing:
                return existing

        # 1. Fetch account (for validation only)
        stmt = select(Account).where(Account.id == data.account_id, Account.user_id == user_id)
        res = await db.execute(stmt)
        account = res.scalar_one_or_none()
        if not account:
            raise ValueError("Счёт списания не найден")

        # 2. Update balances
        amt = to_dec(data.amount)
        if data.type == "expense":
            account.balance = to_dec(account.balance) - amt
        elif data.type == "income":
            account.balance = to_dec(account.balance) + amt
        elif data.type == "transfer":
            if not data.to_account_id:
                raise ValueError("Для перевода необходимо указать счет зачисления")
            stmt_to = select(Account).where(Account.id == data.to_account_id, Account.user_id == user_id)
            res_to = await db.execute(stmt_to)
            to_account = res_to.scalar_one_or_none()
            if not to_account:
                raise ValueError("Счёт зачисления не найден")
            account.balance = to_dec(account.balance) - amt
            to_account.balance = to_dec(to_account.balance) + amt

        # 3. Create transaction record
        tx = Transaction(
            user_id=user_id,
            client_id=data.client_id,
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
            tx_amt = to_dec(tx.amount)
            if tx.type == "expense":
                acc.balance = to_dec(acc.balance) + tx_amt
            elif tx.type == "income":
                acc.balance = to_dec(acc.balance) - tx_amt
            elif tx.type == "transfer" and tx.to_account_id:
                acc.balance = to_dec(acc.balance) + tx_amt
                stmt_to = select(Account).where(Account.id == tx.to_account_id)
                res_to = await db.execute(stmt_to)
                to_acc = res_to.scalar_one_or_none()
                if to_acc:
                    to_acc.balance = to_dec(to_acc.balance) - tx_amt

        await db.delete(tx)
        await db.commit()
        return True

    @staticmethod
    async def update_transaction(db: AsyncSession, user_id: int, tx_id: str, data: dict) -> Optional[Transaction]:
        stmt = select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id)
        res = await db.execute(stmt)
        tx = res.scalar_one_or_none()

        if not tx:
            # UPSERT: Transaction does not exist in DB yet (e.g. initial transaction from client or legacy ID)
            new_account_id = data.get("account_id")
            if not new_account_id:
                default_acc = await FinanceService.get_default_account(db, user_id)
                new_account_id = default_acc.id if default_acc else None
            if not new_account_id:
                return None

            new_to_account_id = data.get("to_account_id")
            new_amount = to_dec(data.get("amount") if data.get("amount") is not None else 0.0)
            new_type = data.get("type") or "expense"

            # Apply balance updates for newly inserted transaction
            stmt_new_acc = select(Account).where(Account.id == new_account_id)
            res_new_acc = await db.execute(stmt_new_acc)
            new_acc = res_new_acc.scalar_one_or_none()
            if new_acc:
                if new_type == "expense":
                    new_acc.balance = to_dec(new_acc.balance) - new_amount
                elif new_type == "income":
                    new_acc.balance = to_dec(new_acc.balance) + new_amount
                elif new_type == "transfer":
                    new_acc.balance = to_dec(new_acc.balance) - new_amount
                    if new_to_account_id:
                        stmt_new_to = select(Account).where(Account.id == new_to_account_id)
                        res_new_to = await db.execute(stmt_new_to)
                        new_to_acc = res_new_to.scalar_one_or_none()
                        if new_to_acc:
                            new_to_acc.balance = to_dec(new_to_acc.balance) + new_amount

            created_at_val = data.get("created_at")
            if isinstance(created_at_val, str):
                try:
                    created_at_val = datetime.fromisoformat(created_at_val.replace("Z", "+00:00"))
                except Exception:
                    created_at_val = datetime.now(timezone.utc)
            elif not isinstance(created_at_val, datetime):
                created_at_val = datetime.now(timezone.utc)

            tx = Transaction(
                id=tx_id,
                user_id=user_id,
                account_id=new_account_id,
                to_account_id=new_to_account_id,
                category_id=data.get("category_id"),
                amount=new_amount,
                type=new_type,
                note=data.get("note"),
                created_at=created_at_val
            )
            db.add(tx)
            await db.commit()
            await db.refresh(tx)
            return tx

        # Revert old balance
        stmt_acc = select(Account).where(Account.id == tx.account_id)
        res_acc = await db.execute(stmt_acc)
        old_acc = res_acc.scalar_one_or_none()
        if old_acc:
            old_amt = to_dec(tx.amount)
            if tx.type == "expense":
                old_acc.balance = to_dec(old_acc.balance) + old_amt
            elif tx.type == "income":
                old_acc.balance = to_dec(old_acc.balance) - old_amt
            elif tx.type == "transfer":
                old_acc.balance = to_dec(old_acc.balance) + old_amt
                if tx.to_account_id:
                    stmt_to = select(Account).where(Account.id == tx.to_account_id)
                    res_to = await db.execute(stmt_to)
                    old_to_acc = res_to.scalar_one_or_none()
                    if old_to_acc:
                        old_to_acc.balance = to_dec(old_to_acc.balance) - old_amt

        # Apply new fields
        new_account_id = data.get("account_id") or tx.account_id
        new_to_account_id = data["to_account_id"] if "to_account_id" in data else tx.to_account_id
        new_amount = to_dec(data.get("amount") if data.get("amount") is not None else tx.amount)
        new_type = data.get("type") or tx.type

        # Apply new balance
        stmt_new_acc = select(Account).where(Account.id == new_account_id)
        res_new_acc = await db.execute(stmt_new_acc)
        new_acc = res_new_acc.scalar_one_or_none()
        if new_acc:
            if new_type == "expense":
                new_acc.balance = to_dec(new_acc.balance) - new_amount
            elif new_type == "income":
                new_acc.balance = to_dec(new_acc.balance) + new_amount
            elif new_type == "transfer":
                new_acc.balance = to_dec(new_acc.balance) - new_amount
                if new_to_account_id:
                    stmt_new_to = select(Account).where(Account.id == new_to_account_id)
                    res_new_to = await db.execute(stmt_new_to)
                    new_to_acc = res_new_to.scalar_one_or_none()
                    if new_to_acc:
                        new_to_acc.balance = to_dec(new_to_acc.balance) + new_amount

        tx.account_id = new_account_id
        tx.to_account_id = new_to_account_id
        tx.amount = new_amount
        tx.type = new_type
        if "category_id" in data:
            tx.category_id = data["category_id"]
        if "note" in data:
            tx.note = data["note"]
        if "created_at" in data and data["created_at"]:
            created_at_val = data["created_at"]
            if isinstance(created_at_val, str):
                try:
                    created_at_val = datetime.fromisoformat(created_at_val.replace("Z", "+00:00"))
                except Exception:
                    pass
            tx.created_at = created_at_val

        await db.commit()
        await db.refresh(tx)
        return tx


    @staticmethod
    async def get_dashboard_summary(db: AsyncSession, user_id: int, month_offset: int = 0) -> DashboardSummary:
        accounts = await FinanceService.get_accounts(db, user_id)
        categories = await FinanceService.get_categories(db, user_id)
        
        total_balance = sum(
            float(a.balance) * (90.0 if a.currency == "USD" else (98.0 if a.currency == "EUR" else 1.0))
            for a in accounts
            if a.group_name != "Кредиты"
        )

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

