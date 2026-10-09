"""Real parser boundaries from the product audit, without cloud requests."""
import asyncio
import json
import httpx
import pytest
from app.core.config import settings
from app.services.ai_parser import AIParserService
from app.services.bank_import_csv import parse_csv
from app.services import ai_limits


@pytest.mark.asyncio
@pytest.mark.parametrize('text', [
    'покупка один миллиард рублей', 'покупка четверть миллиона рублей',
    'карта №1234', 'карта ****1234',
])
async def test_offline_source_guard_never_proposes_partial_scale_or_card_id(monkeypatch, text):
    monkeypatch.setattr(settings, 'AI_PROVIDER', 'disabled')
    result = await AIParserService.parse_financial_text(text, [], [])
    assert result.transactions == [] and result.clarification


def test_large_csv_field_is_a_safe_validation_error():
    data = b'date,amount,currency,description\n2026-10-01,-1,RUB,' + b'x' * 140000
    with pytest.raises(ValueError, match='CSV'):
        parse_csv(data, 'synthetic', 'RUB')


def test_utc_overflow_excludes_one_row_and_keeps_valid_neighbor():
    data = b'date,amount,currency,description\n0001-01-01T00:00:00+01:00,-1,RUB,bad\n2026-10-01,-2,RUB,valid'
    rows = parse_csv(data, 'synthetic', 'RUB')
    assert len(rows) == 2
    assert rows[0]['error'] and not rows[0]['include']
    assert rows[1]['include'] and rows[1]['amount'] == '2.00'


@pytest.mark.asyncio
async def test_groq_two_stages_share_overall_deadline_and_release_slots(monkeypatch):
    monkeypatch.setattr(settings, 'AI_PROVIDER', 'groq')
    monkeypatch.setattr(settings, 'AI_UPLOAD_CONSENT', True)
    monkeypatch.setattr(settings, 'GROQ_API_KEY', 'synthetic')
    monkeypatch.setattr(ai_limits, 'CLOUD_REQUEST_SECONDS', .06)
    count = 0
    async def handler(request):
        nonlocal count
        count += 1
        await asyncio.sleep(.04)
        if request.url.path.endswith('/transcriptions'):
            return httpx.Response(200, json={'text': 'кофе 250 рублей'})
        return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps({'transactions': [{'amount': 250}]})}}]})
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kw: original(**kw, transport=httpx.MockTransport(handler)))
    with pytest.raises(ValueError, match='Распознавание недоступно'):
        await AIParserService.parse_media(b'OggS' + bytes(100), 'audio/ogg', [], [])
    assert count == 2
    # Acquire all four together: acquiring just one could hide a leaked slot.
    entered = 0
    all_entered = asyncio.Event()
    async def take_slot():
        nonlocal entered
        async with ai_limits.cloud_slot():
            entered += 1
            if entered == 4:
                all_entered.set()
            await all_entered.wait()
    await asyncio.gather(*(take_slot() for _ in range(4)))
    assert entered == 4
