from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from app.core.config import settings

def get_transaction_inline_kb(tx_id: str) -> InlineKeyboardMarkup:
    buttons = [
        [
            InlineKeyboardButton(text="❌ Отменить запись", callback_data=f"tx_del:{tx_id}")
        ],
        [
            InlineKeyboardButton(text="📱 Открыть в приложении", web_app=WebAppInfo(url=settings.WEBAPP_URL))
        ]
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)
