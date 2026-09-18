import hmac
import hashlib
import json
import urllib.parse
from typing import Optional, Dict, Any
from app.core.config import settings

def validate_telegram_init_data(init_data: str, bot_token: str) -> Optional[Dict[str, Any]]:
    """
    Validates Telegram WebApp initData string using HMAC-SHA256.
    Returns parsed user dict if valid, None otherwise.
    """
    if not init_data:
        return None

    # Development/Demo fallback for testing directly in browser
    if settings.DEBUG and (init_data.startswith("demo") or init_data.startswith("test")):
        try:
            # Format: demo:USER_ID
            parts = init_data.split(":")
            uid = int(parts[1]) if len(parts) > 1 else 999999
            return {
                "id": uid,
                "first_name": "Demo",
                "username": "demo_user"
            }
        except Exception:
            return {"id": 999999, "first_name": "Demo"}

    try:
        parsed_data = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
        received_hash = parsed_data.pop("hash", None)
        if not received_hash:
            return None

        # Build data check string
        data_check_list = []
        for k in sorted(parsed_data.keys()):
            data_check_list.append(f"{k}={parsed_data[k]}")
        data_check_string = "\n".join(data_check_list)

        # Secret key = HMAC-SHA-256("WebAppData", bot_token)
        secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
        # Hash = HMAC-SHA-256(secret_key, data_check_string)
        calculated_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

        if hmac.compare_digest(calculated_hash, received_hash):
            user_raw = parsed_data.get("user")
            if user_raw:
                return json.loads(user_raw)
            return {"id": int(parsed_data.get("auth_date", 1))}
        
        return None
    except Exception:
        return None
