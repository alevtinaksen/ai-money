import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.database import Base
from app.services.finance_svc import FinanceService
from app.services.ai_parser import AIParserService
from app.schemas.finance import TransactionCreate
from app.core.security import validate_telegram_init_data

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with async_session() as session:
        yield session

    await engine.dispose()

@pytest.mark.asyncio
async def test_seed_and_get_accounts(db_session: AsyncSession):
    user_id = 123456
    await FinanceService.ensure_user_seeded(db_session, user_id)
    
    accounts = await FinanceService.get_accounts(db_session, user_id)
    assert len(accounts) == 8
    alpha_acc = next(a for a in accounts if a.name == "Карта Альфа")
    assert float(alpha_acc.balance) == 5522.16
    assert alpha_acc.is_default is True

@pytest.mark.asyncio
async def test_create_expense_updates_balance(db_session: AsyncSession):
    user_id = 123456
    await FinanceService.ensure_user_seeded(db_session, user_id)
    accounts = await FinanceService.get_accounts(db_session, user_id)
    categories = await FinanceService.get_categories(db_session, user_id)

    alpha_acc = next(a for a in accounts if a.name == "Карта Альфа")
    food_cat = next(c for c in categories if c.name == "Еда")
    initial_balance = float(alpha_acc.balance)

    tx_payload = TransactionCreate(
        account_id=alpha_acc.id,
        category_id=food_cat.id,
        amount=250.0,
        type="expense",
        note="Кофе"
    )
    tx = await FinanceService.create_transaction(db_session, user_id, tx_payload)
    assert tx.amount == 250.0

    # Verify balance reduced
    updated_accounts = await FinanceService.get_accounts(db_session, user_id)
    updated_alpha = next(a for a in updated_accounts if a.id == alpha_acc.id)
    assert float(updated_alpha.balance) == initial_balance - 250.0

    # Delete transaction and verify balance restored
    deleted = await FinanceService.delete_transaction(db_session, user_id, tx.id)
    assert deleted is True
    restored_accounts = await FinanceService.get_accounts(db_session, user_id)
    restored_alpha = next(a for a in restored_accounts if a.id == alpha_acc.id)
    assert float(restored_alpha.balance) == initial_balance

def test_security_demo_mode():
    res = validate_telegram_init_data("demo:12345", "test_bot_token")
    assert res is not None
    assert res["id"] == 12345

@pytest.mark.asyncio
async def test_ai_fallback_parser():
    text = "Кофе 250 с карты Альфа и аптека 1500"
    acc_names = ["Карта Альфа", "Т-Банк", "Наличные"]
    cat_names = ["Еда", "Здоровье", "Транспорт"]
    
    result = await AIParserService.parse_financial_text(text, acc_names, cat_names)
    assert len(result.transactions) == 2
    assert result.transactions[0].amount == 250.0
    assert result.transactions[0].category_name == "Еда"
    assert result.transactions[1].amount == 1500.0
    assert result.transactions[1].category_name == "Здоровье"
