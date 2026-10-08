"""HTTP contract regressions: auth, body limits, safe reads and revisions."""
import pytest
import pytest_asyncio
import httpx
from app.main import app
from app.core.config import settings
from app.core.database import Base, get_db, create_engine_and_session
from app.api.deps import _local_sessions


@pytest_asyncio.fixture
async def client(tmp_path, monkeypatch):
    engine, factory = create_engine_and_session(f"sqlite+aiosqlite:///{tmp_path / 'http.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async def db_override():
        async with factory() as db:
            yield db
    app.dependency_overrides[get_db] = db_override
    monkeypatch.setattr(settings, "ALLOW_LOCAL_LOGIN", True)
    monkeypatch.setattr(settings, "APP_ENV", "development")
    monkeypatch.setattr(settings, "HOST", "127.0.0.1")
    _local_sessions.clear()
    transport = httpx.ASGITransport(app=app, client=("127.0.0.1", 1234))
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost:8000") as client:
        yield client
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_http_auth_read_onboarding_and_revision(client):
    assert (await client.get("/api/accounts?user_id=42", headers={"X-User-Id":"42"})).status_code == 401
    login = await client.post("/api/auth/local")
    assert login.status_code == 200
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
    assert (await client.get("/api/accounts")).json() == []
    assert (await client.post("/api/onboarding")).status_code == 200
    account = (await client.get("/api/accounts")).json()[0]
    assert account["balance"] == 0
    tx = await client.post("/api/transactions", json={
        "account_id":account["id"], "type":"expense", "amount":"0.25", "client_id":"http-case",
    })
    assert tx.status_code == 200, tx.text
    tx = tx.json()
    assert (await client.delete(f"/api/transactions/{tx['id']}")).status_code == 422
    assert (await client.delete(f"/api/transactions/{tx['id']}?revision=2")).status_code == 409
    assert (await client.delete(f"/api/transactions/{tx['id']}?revision=1")).status_code == 200
    assert (await client.get("/api/accounts")).json()[0]["balance"] == 0


@pytest.mark.asyncio
async def test_chunked_upload_rejected_before_parsing(client):
    async def chunks():
        for _ in range(7):
            yield b"x" * (1024 * 1024)
    response = await client.post("/api/ai/parse-voice", content=chunks(),
        headers={"content-type":"application/octet-stream"})
    assert response.status_code == 413


@pytest.mark.asyncio
async def test_local_login_foreign_origin_forbidden(client):
    response = await client.post("/api/auth/local", headers={"Origin":"https://evil.example"})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_null_date_rejected_without_financial_mutation(client):
    login = await client.post('/api/auth/local')
    client.headers['Authorization'] = f"Bearer {login.json()['access_token']}"
    await client.post('/api/onboarding')
    account = (await client.get('/api/accounts')).json()[0]
    tx = (await client.post('/api/transactions', json={
        'account_id': account['id'], 'amount': '1.00', 'client_id': 'null-date'
    })).json()
    result = await client.put(f"/api/transactions/{tx['id']}", json={
        'revision': 1, 'amount': '2.00', 'created_at': None
    })
    assert result.status_code == 422
    assert (await client.get('/api/accounts')).json()[0]['balance'] == -1
    assert (await client.get('/api/transactions')).json()[0]['revision'] == 1
    assert (await client.get('/api/analytics/dashboard')).status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize('name', ['', 'x' * 101])
async def test_invalid_account_name_update_never_persists(client, name):
    login = await client.post('/api/auth/local')
    client.headers['Authorization'] = f"Bearer {login.json()['access_token']}"
    account = (await client.post('/api/accounts', json={'name': 'Original', 'balance': 100})).json()
    response = await client.put(f"/api/accounts/{account['id']}", json={
        'name': name, 'color': '#123456',
    })
    assert response.status_code == 422
    listing = await client.get('/api/accounts')
    assert listing.status_code == 200
    assert listing.json() == [account]


@pytest.mark.asyncio
async def test_category_analytics_http_auth_parameters_and_empty_month(client):
    path = '/api/analytics/categories/uncategorized'
    assert (await client.get(path)).status_code == 401
    login = await client.post('/api/auth/local')
    client.headers['Authorization'] = f"Bearer {login.json()['access_token']}"
    result = await client.get(path + '?kind=income&currency=USD')
    assert result.status_code == 200
    assert result.json()['total_amount'] == 0 and result.json()['transactions'] == []
    assert (await client.get(path + '?kind=transfer')).status_code == 422
    assert (await client.get(path + '?offset=-1')).status_code == 422
    assert (await client.get('/api/analytics/categories/nonexistent')).status_code == 400


@pytest.mark.asyncio
async def test_browser_audio_mime_parameters_are_normalized(client, monkeypatch):
    from app.schemas.finance import AIParsedResult
    from app.services.ai_parser import AIParserService
    seen = []
    async def parser(data, mime, accounts, categories):
        seen.append(mime)
        return AIParsedResult()
    monkeypatch.setattr(AIParserService, 'parse_media', parser)
    login = await client.post('/api/auth/local')
    client.headers['Authorization'] = f"Bearer {login.json()['access_token']}"
    response = await client.post('/api/ai/parse-voice', files={
        'file': ('voice.webm', b'synthetic', 'audio/webm;codecs=opus')})
    assert response.status_code == 200 and seen == ['audio/webm']
