from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
import pytest
from test_http import client as client
from app.core.config import settings
import app.main as main


@pytest.mark.asyncio
async def test_webhook_requires_mode_secret_and_matching_header(client, monkeypatch):
    dispatcher = SimpleNamespace(feed_update=AsyncMock())
    monkeypatch.setattr(main, 'bot_instance', Mock())
    monkeypatch.setattr(main, 'dispatcher', dispatcher)
    monkeypatch.setattr(settings, 'TELEGRAM_MODE', 'polling')
    payload = {'update_id': 1}
    assert (await client.post('/api/telegram/webhook', json=payload)).status_code == 404
    monkeypatch.setattr(settings, 'TELEGRAM_MODE', 'webhook')
    monkeypatch.setattr(settings, 'TELEGRAM_WEBHOOK_SECRET', None)
    assert (await client.post('/api/telegram/webhook', json=payload)).status_code == 404
    monkeypatch.setattr(settings, 'TELEGRAM_WEBHOOK_SECRET', 'synthetic-secret')
    assert (await client.post('/api/telegram/webhook', json=payload)).status_code == 403
    result = await client.post('/api/telegram/webhook', json=payload,
        headers={'X-Telegram-Bot-Api-Secret-Token': 'synthetic-secret'})
    assert result.status_code == 200
    dispatcher.feed_update.assert_awaited_once()


@pytest.mark.asyncio
async def test_api_does_not_start_polling_and_invalid_webhook_fails_closed(monkeypatch):
    monkeypatch.setattr(settings, 'ALLOW_LOCAL_LOGIN', False)
    monkeypatch.setattr(settings, 'BOT_TOKEN', 'synthetic')
    monkeypatch.setattr(settings, 'TELEGRAM_MODE', 'polling')
    monkeypatch.setattr(main, 'init_db', AsyncMock())
    monkeypatch.setattr(main, 'engine', SimpleNamespace(dispose=AsyncMock()))
    factory = Mock(side_effect=AssertionError('API started bot in polling mode'))
    monkeypatch.setattr(main, 'Bot', factory)
    async with main.lifespan(main.app):
        factory.assert_not_called()
    monkeypatch.setattr(settings, 'TELEGRAM_MODE', 'webhook')
    monkeypatch.setattr(settings, 'TELEGRAM_WEBHOOK_SECRET', None)
    with pytest.raises(RuntimeError, match='Webhook requires'):
        async with main.lifespan(main.app):
            pass


@pytest.mark.asyncio
async def test_production_rejects_ephemeral_sqlite(monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_LOCAL_LOGIN", False)
    monkeypatch.setattr(settings, "TELEGRAM_MODE", "disabled")
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "SQLITE_PERSISTENT_STORAGE", False)
    monkeypatch.setattr(settings, "DATABASE_URL", "sqlite+aiosqlite:////tmp/ephemeral.db")
    with pytest.raises(RuntimeError, match="PostgreSQL"):
        async with main.lifespan(main.app):
            pytest.fail("Production accepted an ephemeral database")
