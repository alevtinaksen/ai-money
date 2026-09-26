import hashlib
import hmac
import json
from urllib.parse import urlencode
from starlette.requests import Request
from app.core.security import validate_telegram_init_data
from app.api.deps import local_request_allowed, issue_local_token
from app.core.config import settings

TOKEN = "synthetic-test-token"


def signed(**changes):
    data = {"auth_date": "1000", "user": json.dumps({"id": 42})}
    data.update(changes)
    secret = hmac.new(b"WebAppData", TOKEN.encode(), hashlib.sha256).digest()
    check = "\n".join(f"{k}={data[k]}" for k in sorted(data))
    data["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(data)


def test_signed_identity_and_expiration():
    assert validate_telegram_init_data(signed(), TOKEN, now=1001) == {"id": 42}
    assert validate_telegram_init_data(signed(), TOKEN, now=5000) is None
    assert validate_telegram_init_data(signed(), TOKEN, now=900) is None


def test_malformed_duplicate_missing_user_and_demo_rejected():
    assert validate_telegram_init_data("demo:42", TOKEN, now=1001) is None
    assert validate_telegram_init_data(signed() + "&auth_date=1000", TOKEN, now=1001) is None
    for user in ["{}", '{"id":true}', '{"id":-1}', "null", "[]"]:
        assert validate_telegram_init_data(signed(user=user), TOKEN, now=1001) is None
    assert validate_telegram_init_data(signed(), "wrong", now=1001) is None


def request(host="localhost:8000", client="127.0.0.1", origin="http://localhost:5173"):
    return Request({"type":"http", "method":"POST", "path":"/api/auth/local",
        "scheme":"http", "server":("127.0.0.1",8000), "client":(client,54321),
        "headers":[(b"host",host.encode()),(b"origin",origin.encode())]})


def test_local_login_cannot_be_public_or_cross_origin(monkeypatch):
    monkeypatch.setattr(settings,"ALLOW_LOCAL_LOGIN",True)
    monkeypatch.setattr(settings,"APP_ENV","development")
    monkeypatch.setattr(settings,"HOST","127.0.0.1")
    assert local_request_allowed(request())
    assert issue_local_token(request())["token_type"] == "Bearer"
    assert not local_request_allowed(request(host="attacker.example"))
    assert not local_request_allowed(request(client="8.8.8.8"))
    assert not local_request_allowed(request(origin="https://evil.example"))
    monkeypatch.setattr(settings,"APP_ENV","production")
    assert not local_request_allowed(request())
