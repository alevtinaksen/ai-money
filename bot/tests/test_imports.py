import pytest
from app.services.bank_import import review, get_batch
from app.domain.errors import ConflictError
from app.schemas.finance import CategoryCreate
from test_finance import account, db_session as db_session
from app.services.bank_import import preview, confirm
from app.services.finance_svc import FinanceService as F


@pytest.mark.asyncio
async def test_preview_does_not_change_money(db_session):
    aid = (await account(db_session)).id
    batch = await preview(
        db_session,
        1,
        aid,
        b"date,amount,currency,description,source_id\n2026-09-01,-10,RUB,Food,bank-1\n",
    )
    assert batch["status"] == "draft"
    assert (await F.get_accounts(db_session, 1))[0].balance == 100
    assert await F.list_transactions(db_session, 1) == []
    result = await confirm(db_session, 1, batch["id"], batch["revision"], [batch["rows"][0]["id"]])
    assert result["status"] == "confirmed"
    assert (await F.get_accounts(db_session, 1))[0].balance == 90


CSV = b"date,amount,currency,description,source_id,status\n2026-09-01,-10,RUB,Food,bank-1,posted\n"


@pytest.mark.asyncio
async def test_tenant_and_mutation_rules(db_session):
    aid = (await account(db_session)).id
    with pytest.raises(ValueError):
        await preview(db_session, 2, aid, CSV)
    batch = await preview(db_session, 1, aid, CSV)
    assert await get_batch(db_session, 2, batch["id"]) is None
    assert await confirm(db_session, 2, batch["id"], 1, [batch["rows"][0]["id"]]) is None
    with pytest.raises(ValueError):
        await review(db_session, 1, batch["id"], batch["rows"][0]["id"], 1, {"amount": "1"})


@pytest.mark.asyncio
async def test_replay_durable_dedup_after_deletion(db_session):
    aid = (await account(db_session)).id
    batch = await preview(db_session, 1, aid, CSV)
    selected = [batch["rows"][0]["id"]]
    done = await confirm(db_session, 1, batch["id"], 1, selected)
    assert (await confirm(db_session, 1, batch["id"], 1, selected))["transaction_ids"] == done[
        "transaction_ids"
    ]
    await F.delete_transaction(db_session, 1, done["transaction_ids"][0], 1)
    again = await preview(db_session, 1, aid, CSV)
    assert again["rows"][0]["duplicate"] and not again["rows"][0]["include"]
    with pytest.raises(ValueError):
        await review(
            db_session,
            1,
            again["id"],
            again["rows"][0]["id"],
            1,
            {"include": True, "force_duplicate": True},
        )
    assert (await F.get_accounts(db_session, 1))[0].balance == 100


@pytest.mark.asyncio
async def test_fingerprint_duplicate_requires_explicit_force(db_session):
    aid = (await account(db_session)).id
    content = b"date,amount,currency,description\n2026-09-01,-10,RUB,Food\n"
    first = await preview(db_session, 1, aid, content)
    await confirm(db_session, 1, first["id"], 1, [first["rows"][0]["id"]])
    second = await preview(db_session, 1, aid, content)
    rid = second["rows"][0]["id"]
    assert second["rows"][0]["duplicate"]
    with pytest.raises(ValueError):
        await review(db_session, 1, second["id"], rid, 1, {"include": True})
    changed = await review(
        db_session, 1, second["id"], rid, 1, {"force_duplicate": True, "include": True}
    )
    await confirm(db_session, 1, second["id"], changed["revision"], [rid])
    assert (await F.get_accounts(db_session, 1))[0].balance == 80


@pytest.mark.asyncio
async def test_invalid_row_excluded_and_atomic_rollback(db_session):
    aid = (await account(db_session)).id
    bad = await F.create_category(db_session, 2, CategoryCreate(name="Other"))
    cid = bad.id
    batch = await preview(db_session, 1, aid, CSV + b"2026-09-02,-5,RUB,Coffee,bank-2,posted\n")
    updated = await review(
        db_session, 1, batch["id"], batch["rows"][1]["id"], 1, {"category_id": cid}
    )
    with pytest.raises(ValueError):
        await confirm(
            db_session, 1, batch["id"], updated["revision"], [r["id"] for r in updated["rows"]]
        )
    assert (await F.get_accounts(db_session, 1))[0].balance == 100
    assert await F.list_transactions(db_session, 1) == []
    assert (await get_batch(db_session, 1, batch["id"])).status == "draft"
    invalid = await preview(
        db_session,
        1,
        aid,
        b"date,amount,currency,description,status,type\nwrong,2,RUB,X,posted,expense\n2026-09-01,2,USD,X,posted,expense\n2026-09-01,2,RUB,X,pending,expense\n2026-09-01,2,RUB,X,posted,transfer\n",
    )
    assert all(r["error"] and not r["include"] for r in invalid["rows"])


@pytest.mark.asyncio
async def test_concurrent_confirm_does_not_double_apply(tmp_path):
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from app.core.database import Base

    engine = create_async_engine("sqlite+aiosqlite:///" + str(tmp_path / "imports.db"))
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with factory() as db:
        aid = (await account(db)).id
        batch = await preview(db, 1, aid, CSV)

    async def do():
        async with factory() as db:
            try:
                return (await confirm(db, 1, batch["id"], 1, [batch["rows"][0]["id"]]))["status"]
            except ConflictError:
                return "conflict"

    outcomes = await asyncio.gather(do(), do())
    assert "confirmed" in outcomes
    async with factory() as db:
        assert (await F.get_accounts(db, 1))[0].balance == 90
        assert len(await F.list_transactions(db, 1)) == 1
    await engine.dispose()


@pytest.mark.asyncio
async def test_csv_bounds(db_session):
    aid = (await account(db_session)).id
    for content in [
        b"",
        b"x" * (1024 * 1024 + 1),
        b"foo,bar\n1,2\n",
        b"\xff\xff",
        b"date,amount,currency,description\n" + b"2026-09-01,1,RUB,X\n" * 1001,
    ]:
        with pytest.raises(ValueError):
            await preview(db_session, 1, aid, content)
