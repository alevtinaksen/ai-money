from typing import Dict, Any, Optional
import time

# user_id -> {"action": "edit_amount" | "edit_note" | "edit_all", "tx_id": str, "message_id": int, "chat_id": int}
USER_EDIT_STATE: Dict[int, Dict[str, Any]] = {}

# pending_id -> {"user_id": int, "type": str, "category_name": str, "account_name": str, "note": str, "created_at": float}
PENDING_CLARIFICATIONS: Dict[str, Dict[str, Any]] = {}

# user_id -> pending_id
USER_ACTIVE_PENDING: Dict[int, str] = {}

def set_user_edit(user_id: int, action: str, tx_id: str, message_id: int, chat_id: int):
    USER_EDIT_STATE[user_id] = {
        "action": action,
        "tx_id": tx_id,
        "message_id": message_id,
        "chat_id": chat_id,
        "timestamp": time.time()
    }

def get_user_edit(user_id: int) -> Optional[Dict[str, Any]]:
    return USER_EDIT_STATE.get(user_id)

def clear_user_edit(user_id: int):
    USER_EDIT_STATE.pop(user_id, None)

def set_pending_clarification(pending_id: str, user_id: int, data: Dict[str, Any]):
    data["user_id"] = user_id
    data["created_at"] = time.time()
    PENDING_CLARIFICATIONS[pending_id] = data
    USER_ACTIVE_PENDING[user_id] = pending_id

def get_pending_clarification(pending_id: str) -> Optional[Dict[str, Any]]:
    return PENDING_CLARIFICATIONS.get(pending_id)

def get_user_active_pending(user_id: int) -> Optional[Dict[str, Any]]:
    pending_id = USER_ACTIVE_PENDING.get(user_id)
    if not pending_id:
        return None
    return PENDING_CLARIFICATIONS.get(pending_id)

def clear_pending_clarification(pending_id: str):
    data = PENDING_CLARIFICATIONS.pop(pending_id, None)
    if data:
        user_id = data.get("user_id")
        if user_id and USER_ACTIVE_PENDING.get(user_id) == pending_id:
            USER_ACTIVE_PENDING.pop(user_id, None)
