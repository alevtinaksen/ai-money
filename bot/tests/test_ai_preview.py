import pytest
from app.services.ai_parser import parse_local, validate_proposals, AIParserService
from app.core.config import settings


def test_local_decimal_and_ambiguous_values():
    assert str(parse_local("расход 250,50 кофе").transactions[0].amount) == "250.50"
    assert str(parse_local("расход 1 500 кофе").transactions[0].amount) == "1500"
    assert str(parse_local("5 тысяч корм коту").transactions[0].amount) == "5000"
    for text in ["26/09 500 кофе", "0.1+0.2", "кофе 100 руб 50 коп"]:
        assert not parse_local(text).transactions
        assert parse_local(text).clarification


@pytest.mark.parametrize("amount", ["-1", "0", "NaN", "Infinity", "0.001", "1000000000000"])
def test_invalid_model_money_rejected(amount):
    with pytest.raises(ValueError):
        validate_proposals({"transactions":[{"amount":amount}]})


@pytest.mark.asyncio
async def test_cloud_disabled_never_uploads(monkeypatch):
    monkeypatch.setattr(settings,"AI_PROVIDER","disabled")
    with pytest.raises(ValueError, match="отключено"):
        await AIParserService.parse_media(b"synthetic", "audio/ogg", [], [])


def test_preview_budget_is_per_user_and_expires(monkeypatch):
    from fastapi import HTTPException
    from app.services import preview_budget as budget
    budget._windows.clear()
    monkeypatch.setattr(budget.time, "monotonic", lambda: 100.0)
    for _ in range(10):
        budget.consume_preview(1)
    with pytest.raises(HTTPException) as error:
        budget.consume_preview(1)
    assert error.value.status_code == 429
    budget.consume_preview(2)
    monkeypatch.setattr(budget.time, "monotonic", lambda: 161.0)
    budget.consume_preview(1)
    budget._windows.clear()
