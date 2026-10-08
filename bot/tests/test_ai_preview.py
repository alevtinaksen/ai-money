import base64
import json
import httpx
import pytest
from app.services.ai_parser import parse_local, validate_proposals, validate_source_amounts, AIParserService
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


@pytest.mark.parametrize('text', ['Такси 450 и аптека 1200', 'поезд 07.10 за 1500',
    'кофе 12.3456', 'расход -500 кофе'])
def test_ambiguous_local_input_requires_clarification(text):
    result = parse_local(text)
    assert not result.transactions
    assert result.clarification


@pytest.mark.asyncio
@pytest.mark.parametrize('provider,consent', [('disabled', True), ('auto', False), ('groq', False)])
async def test_consent_gate_for_all_adapters(monkeypatch, provider, consent):
    monkeypatch.setattr(settings, 'AI_PROVIDER', provider)
    monkeypatch.setattr(settings, 'AI_UPLOAD_CONSENT', consent)
    monkeypatch.setattr(settings, 'GROQ_API_KEY', 'synthetic')
    async def forbidden(*args, **kwargs):
        pytest.fail('External adapter reached without consent')
    monkeypatch.setattr(AIParserService, '_generate_groq', forbidden)
    assert (await AIParserService.parse_financial_text('кофе 250', [], [])).transactions
    with pytest.raises(ValueError):
        await AIParserService.transcribe_audio(b'synthetic')
    with pytest.raises(ValueError):
        await AIParserService.parse_media(b'synthetic', 'audio/ogg', [], [])


@pytest.mark.parametrize('text,expected', [('кофе 2.01 тыс', '2010'), ('кофе 2.01 млн', '2010000')])
def test_scaled_decimal_money_is_exact(text, expected):
    assert str(parse_local(text).transactions[0].amount) == expected


def test_transfer_intent_handles_cyrillic_yo():
    assert parse_local('перевёл 500 с одного счёта на другой').transactions[0].type == 'transfer'


@pytest.mark.asyncio
@pytest.mark.parametrize('mime,data,wire_mime', [
    ('audio/ogg', b'OggS' + bytes(100), 'audio/ogg'),
    ('audio/mp4', bytes(4) + b'ftypM4A ' + bytes(40), 'audio/m4a'),
])
async def test_gemini_audio_inline_wire_and_proposal(monkeypatch, mime, data, wire_mime):
    monkeypatch.setattr(settings, 'AI_PROVIDER', 'gemini')
    monkeypatch.setattr(settings, 'AI_UPLOAD_CONSENT', True)
    monkeypatch.setattr(settings, 'GEMINI_API_KEY', 'synthetic')

    async def handler(request):
        payload = json.loads(request.content)
        assert request.headers['x-goog-api-key'] == 'synthetic'
        inline = payload['contents'][0]['parts'][1]['inline_data']
        assert inline['mime_type'] == wire_mime
        assert base64.b64decode(inline['data']) == data
        proposal = json.dumps({'transcript': 'расход 250 рублей кофе', 'transactions': [{'amount': 250, 'type': 'expense'}]})
        return httpx.Response(200, json={'candidates': [{'content': {'parts': [{'text': proposal}]}}]})

    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kw: original(**kw, transport=httpx.MockTransport(handler)))
    assert (await AIParserService.parse_media(data, mime, [], [])).transactions[0].amount == 250


@pytest.mark.parametrize('source,amount', [
    ('расход 5000 рублей кофе', '5000'),
    ('расход пять тысяч рублей кофе', '5000'),
    ('кофе 5 000 рублей', '5000'),
    ('расход 250,50 рублей кофе', '250.50'),
    ('расход 250.50 рублей кофе', '250.50'),
    ('расход двести пятьдесят рублей пятьдесят копеек кофе', '250.50'),
    ('расход два рубля пятьдесят копеек кофе', '2.50'),
    ('кофе 2 тысячи рублей', '2000'),
    ('кофе две тысячи рублей', '2000'),
    ('кофе 2.01 тыс рублей', '2010'),
    ('расход полтора миллиона рублей', '1500000'),
    ('расход полторы тысячи рублей', '1500'),
    ('расход полторы рубля', '1.5'),
])
def test_source_amount_consistency_preserves_exact_money(source, amount):
    result = validate_source_amounts({'transactions': [{'amount': amount}]}, source)
    assert len(result.transactions) == 1
    assert str(result.transactions[0].amount) == amount


@pytest.mark.parametrize('source,wrong', [
    ('расход 5000 рублей', '50'), ('расход 5000 рублей', '0'), ('расход 5000 рублей', '55'),
    ('расход пять тысяч рублей', '50'), ('расход 250.50 рублей', '250'),
    ('расход 2 тысячи рублей', '2'), ('кофе 5,000 рублей', '5000'),
    ('две чашки кофе по 250 рублей', '500'), ('кофе 250 рублей 07.10', '250'),
    ('кофе 250 рублей с карты 1234', '1234'), ('кофе 250 и такси 450', '700'),
    ('ничего не потратила', '50'), ('кофе 0.001 рублей', '0.01'),
    ('расход полтора миллиона рублей', '1000000'),
    ('расход полторы миллиона рублей', '1500'),
    ('расход четверть миллиона рублей', '1000000'),
    ('расход один миллиард рублей', '1'), ('расход один триллион рублей', '1'),
    ('расход две сотни рублей', '2'), ('расход пять десятков рублей', '5'),
    ('расход пара тысяч рублей', '1000'),
    ('покупка с карты №1234', '1234'), ('покупка с карты ****1234', '1234'),
])
def test_conflicting_or_ambiguous_source_needs_clarification(source, wrong):
    result = validate_source_amounts({'transactions': [{'amount': wrong}]}, source)
    assert not result.transactions
    assert 'Уточните' in result.clarification


def test_explicit_multiple_money_amounts_preserved_without_summing():
    result = validate_source_amounts({'transactions': [{'amount': '250'}, {'amount': '450'}]},
                                    'кофе 250 рублей и такси 450 рублей')
    assert [str(tx.amount) for tx in result.transactions] == ['250', '450']


def test_multiple_money_amounts_with_ruble_sign_are_preserved():
    result = validate_source_amounts({'transactions': [{'amount': '250'}, {'amount': '450'}]},
                                    'кофе 250 ₽ и такси 450 ₽')
    assert [str(tx.amount) for tx in result.transactions] == ['250', '450']


@pytest.mark.asyncio
@pytest.mark.parametrize('transcript,amount', [('расход 5000 рублей', 50), ('расход 5000 рублей', 0),
    ('расход пять тысяч рублей', 55), (None, 5000)])
async def test_gemini_audio_amount_conflict_or_missing_transcript(monkeypatch, transcript, amount):
    monkeypatch.setattr(settings, 'AI_PROVIDER', 'gemini')
    monkeypatch.setattr(settings, 'AI_UPLOAD_CONSENT', True)
    monkeypatch.setattr(settings, 'GEMINI_API_KEY', 'synthetic')
    async def handler(request):
        result = {'transactions': [{'amount': amount}], 'transcript': transcript}
        content = json.dumps(result)
        return httpx.Response(200, json={'candidates': [{'content': {'parts': [{'text': content}]}}]})
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kw: original(**kw, transport=httpx.MockTransport(handler)))
    result = await AIParserService.parse_media(b'OggS' + bytes(100), 'audio/ogg', [], [])
    assert not result.transactions
    assert 'Уточните' in result.clarification


@pytest.mark.asyncio
async def test_gemini_receipt_multiple_proposals_are_not_audio_guarded(monkeypatch):
    monkeypatch.setattr(settings, 'AI_PROVIDER', 'gemini')
    monkeypatch.setattr(settings, 'AI_UPLOAD_CONSENT', True)
    monkeypatch.setattr(settings, 'GEMINI_API_KEY', 'synthetic')
    async def handler(request):
        content = json.dumps({'transactions': [{'amount': 250}, {'amount': 55}]})
        return httpx.Response(200, json={'candidates': [{'content': {'parts': [{'text': content}]}}]})
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kw: original(**kw, transport=httpx.MockTransport(handler)))
    result = await AIParserService.parse_media(b'synthetic receipt', 'image/jpeg', [], [])
    assert len(result.transactions) == 2
