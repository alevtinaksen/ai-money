from typing import Optional
from fastapi import Header, HTTPException, Query, Depends, Request
from app.core.config import settings
from app.core.security import validate_telegram_init_data

async def get_current_user_id(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[int] = Header(None, alias="X-User-Id"),
    user_id_query: Optional[int] = Query(None, alias="user_id")
) -> int:
    """
    Extracts and verifies the Telegram user ID from initData or headers.
    """
    # 1. Direct user_id passed in development or query
    if user_id_query:
        return user_id_query
    if x_user_id:
        return x_user_id

    # 2. Telegram WebApp Authorization header: "tma <initData>"
    if authorization:
        parts = authorization.split(" ", 1)
        init_data = parts[1] if len(parts) == 2 else parts[0]
        
        user_info = validate_telegram_init_data(init_data, settings.BOT_TOKEN)
        if user_info and "id" in user_info:
            return int(user_info["id"])

    # 3. Fallback for demo/dev mode
    if settings.DEBUG:
        return 999999

    raise HTTPException(status_code=401, detail="Не авторизован: отсутствует или невалиден initData")
