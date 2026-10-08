"""Graph checks and writes must be serialized across independent sessions."""
import asyncio

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Base, create_engine_and_session
from app.models.models import Category
from app.schemas.finance import CategoryCreate
from app.services.finance_svc import FinanceService as F


@pytest.mark.parametrize('race', [
    'cycle', 'create_archive', 'move_archive', 'archive_create', 'archive_move',
])
async def test_graph_validation_and_mutation_are_one_critical_section(tmp_path, monkeypatch, race):
    engine, factory = create_engine_and_session(f"sqlite+aiosqlite:///{tmp_path / 'graph.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with factory() as db:
        first = await F.create_category(db, 1, CategoryCreate(name='First'))
        second = await F.create_category(db, 1, CategoryCreate(name='Second'))
        first_id, second_id = first.id, second.id

    # Hold the first writer after its checks, just before flush/commit. Without a
    # database lock the other session also validates the old graph and commits.
    original_commit = AsyncSession.commit
    first_checked = asyncio.Event()
    second_checked = asyncio.Event()

    async def scheduled_commit(db):
        if db.info.get('operation') == 'first':
            first_checked.set()
            try:
                await asyncio.wait_for(second_checked.wait(), timeout=0.15)
            except asyncio.TimeoutError:
                pass  # A serialized second writer cannot pass its checks yet.
        elif db.info.get('operation') == 'second':
            second_checked.set()
        await original_commit(db)

    monkeypatch.setattr(AsyncSession, 'commit', scheduled_commit)

    async def mutate(operation):
        async with factory() as db:
            db.info['operation'] = operation
            try:
                if operation == 'first':
                    if race.startswith('archive_'):
                        await F.delete_category(db, 1, second_id)
                    elif race == 'create_archive':
                        await F.create_category(db, 1, CategoryCreate(name='Child', parent_id=second_id))
                    else:
                        await F.update_category(db, 1, first_id, {'parent_id': second_id})
                elif race == 'cycle':
                    await F.update_category(db, 1, second_id, {'parent_id': first_id})
                elif race == 'archive_create':
                    await F.create_category(db, 1, CategoryCreate(name='Child', parent_id=second_id))
                elif race == 'archive_move':
                    await F.update_category(db, 1, first_id, {'parent_id': second_id})
                else:
                    await F.delete_category(db, 1, second_id)
                return 'saved'
            except ValueError:
                return 'rejected'

    try:
        first_task = asyncio.create_task(mutate('first'))
        await asyncio.wait_for(first_checked.wait(), timeout=2)
        second_task = asyncio.create_task(mutate('second'))
        assert await asyncio.gather(first_task, second_task) == ['saved', 'rejected']
        async with factory() as db:
            categories = list((await db.scalars(select(Category))).all())
            graph = {c.id: c for c in categories}
            for category in categories:
                seen = {category.id}
                parent_id = category.parent_id
                while parent_id:
                    assert parent_id not in seen
                    seen.add(parent_id)
                    parent = graph[parent_id]
                    if not category.is_archived:
                        assert not parent.is_archived
                    parent_id = parent.parent_id
    finally:
        await engine.dispose()


async def test_rejected_graph_write_releases_lock_before_session_closes(tmp_path):
    engine, factory = create_engine_and_session(f"sqlite+aiosqlite:///{tmp_path / 'rollback.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        async with factory() as db:
            category_id = (await F.create_category(db, 1, CategoryCreate(name='Root'))).id
            with pytest.raises(ValueError):
                await F.update_category(db, 1, category_id, {'parent_id': category_id})
            async with factory() as competitor:
                child = await asyncio.wait_for(F.create_category(
                    competitor, 1, CategoryCreate(name='After rejection', parent_id=category_id),
                ), timeout=2)
                assert child.parent_id == category_id
    finally:
        await engine.dispose()
