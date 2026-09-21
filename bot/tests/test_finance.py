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
    assert len(accounts) >= 8
    default_acc = next(a for a in accounts if a.is_default is True)
    assert "Альфа" in default_acc.name
    assert default_acc.balance > 0

@pytest.mark.asyncio
async def test_create_expense_updates_balance(db_session: AsyncSession):
    user_id = 123456
    await FinanceService.ensure_user_seeded(db_session, user_id)
    accounts = await FinanceService.get_accounts(db_session, user_id)
    categories = await FinanceService.get_categories(db_session, user_id)

    target_acc = accounts[0]
    food_cat = next(c for c in categories if c.name == "Еда")
    initial_balance = float(target_acc.balance)

    tx_payload = TransactionCreate(
        account_id=target_acc.id,
        category_id=food_cat.id,
        amount=250.0,
        type="expense",
        note="Кофе"
    )
    tx = await FinanceService.create_transaction(db_session, user_id, tx_payload)
    assert tx.amount == 250.0

    # Verify balance reduced
    updated_accounts = await FinanceService.get_accounts(db_session, user_id)
    updated_target = next(a for a in updated_accounts if a.id == target_acc.id)
    assert float(updated_target.balance) == initial_balance - 250.0

    # Test update transaction amount
    updated_tx = await FinanceService.update_transaction(db_session, user_id, tx.id, {"amount": 350.0})
    assert updated_tx.amount == 350.0
    after_update_accounts = await FinanceService.get_accounts(db_session, user_id)
    after_update_acc = next(a for a in after_update_accounts if a.id == target_acc.id)
    assert float(after_update_acc.balance) == initial_balance - 350.0

    # Delete transaction and verify balance restored
    deleted = await FinanceService.delete_transaction(db_session, user_id, tx.id)
    assert deleted is True
    restored_accounts = await FinanceService.get_accounts(db_session, user_id)
    restored_target = next(a for a in restored_accounts if a.id == target_acc.id)
    assert float(restored_target.balance) == initial_balance

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

@pytest.mark.asyncio
async def test_ai_speech_normalization_and_clarification():
    acc_names = ["Карта Альфа (Основной)", "Т-Банк"]
    cat_names = ["Личное", "Еда"]

    # 1. 2/100 should normalize to 2100
    res1 = await AIParserService.parse_financial_text("Запиши 2/100 маникюр", acc_names, cat_names)
    assert len(res1.transactions) == 1
    assert res1.transactions[0].amount == 2100.0

    # 2. Ambiguous or missing amount should yield pending clarification
    res2 = await AIParserService.parse_financial_text("Запиши маникюр", acc_names, cat_names)
    assert len(res2.transactions) == 0
    assert len(res2.pending.suggested_options) > 0
    assert 2000.0 in res2.pending.suggested_options

@pytest.mark.asyncio
async def test_update_transaction_upsert_nonexistent(db_session: AsyncSession):
    user_id = 123456
    await FinanceService.ensure_user_seeded(db_session, user_id)
    accounts = await FinanceService.get_accounts(db_session, user_id)
    target_acc = accounts[0]
    initial_balance = float(target_acc.balance)

    # Unknown ID (e.g. from frontend initial mock data)
    unknown_id = "unknown-custom-uuid-999"
    data = {
        "account_id": target_acc.id,
        "amount": 500.0,
        "type": "expense",
        "note": "Прямое сохранение новой транзакции через PUT"
    }

    # Should perform UPSERT and not raise error or return None
    tx = await FinanceService.update_transaction(db_session, user_id, unknown_id, data)
    assert tx is not None
    assert tx.id == unknown_id
    assert float(tx.amount) == 500.0

    # Verify balance reduced
    accs_after = await FinanceService.get_accounts(db_session, user_id)
    updated_acc = next(a for a in accs_after if a.id == target_acc.id)
    assert float(updated_acc.balance) == initial_balance - 500.0

@pytest.mark.asyncio
async def test_transfer_update_recalculation(db_session: AsyncSession):
    user_id = 123456
    await FinanceService.ensure_user_seeded(db_session, user_id)
    accounts = await FinanceService.get_accounts(db_session, user_id)
    from_acc = accounts[0]
    to_acc = accounts[1]
    init_from = float(from_acc.balance)
    init_to = float(to_acc.balance)

    # Initial transfer of 100
    tx_id = "transfer-test-123"
    data = {
        "account_id": from_acc.id,
        "to_account_id": to_acc.id,
        "amount": 100.0,
        "type": "transfer",
        "note": "Перевод 100"
    }
    tx = await FinanceService.update_transaction(db_session, user_id, tx_id, data)
    assert tx is not None

    accs = await FinanceService.get_accounts(db_session, user_id)
    f1 = next(a for a in accs if a.id == from_acc.id)
    t1 = next(a for a in accs if a.id == to_acc.id)
    assert float(f1.balance) == init_from - 100.0
    assert float(t1.balance) == init_to + 100.0

    # Now edit transfer amount to 350
    data2 = {
        "account_id": from_acc.id,
        "to_account_id": to_acc.id,
        "amount": 350.0,
        "type": "transfer",
        "note": "Перевод 350"
    }
    tx2 = await FinanceService.update_transaction(db_session, user_id, tx_id, data2)
    assert tx2 is not None

    accs2 = await FinanceService.get_accounts(db_session, user_id)
    f2 = next(a for a in accs2 if a.id == from_acc.id)
    t2 = next(a for a in accs2 if a.id == to_acc.id)
    assert float(f2.balance) == init_from - 350.0
    assert float(t2.balance) == init_to + 350.0

