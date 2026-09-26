"""Telegram Mini App signatures with bounded lifetime."""
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl


def validate_telegram_init_data(init_data: str, bot_token: str, *,
                                now: float | None = None,
                                max_age: int = 3600) -> dict | None:
    """Return the signed Telegram user, never a guessed identity."""
    if not bot_token or not init_data or len(init_data) > 16384:
        return None
    try:
        pairs = parse_qsl(init_data, keep_blank_values=True, strict_parsing=True)
        data = dict(pairs)
        if len(data) != len(pairs):
            return None
        received = data.pop("hash", "")
        check = "\n".join(f"{key}={data[key]}" for key in sorted(data))
        secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        expected = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, received):
            return None
        age = (time.time() if now is None else now) - int(data["auth_date"])
        if age < -30 or age > max_age:
            return None
        user = json.loads(data["user"])
        uid = user.get("id")
        if type(uid) is not int or not 0 < uid < 2**63:
            return None
        return user
    except (ValueError, KeyError, TypeError, AttributeError):
        return None
