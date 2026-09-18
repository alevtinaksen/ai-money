from typing import List
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from app.core.config import settings

def get_transaction_inline_kb(tx_id: str) -> InlineKeyboardMarkup:
    buttons = [
        [
            InlineKeyboardButton(text="📁 Категория", callback_data=f"tx_edit_cat:{tx_id}"),
            InlineKeyboardButton(text="💳 Счёт", callback_data=f"tx_edit_acc:{tx_id}"),
        ],
        [
            InlineKeyboardButton(text="❌ Отменить запись", callback_data=f"tx_del:{tx_id}")
        ]
    ]
    if settings.WEBAPP_URL and not settings.WEBAPP_URL.startswith("http://localhost"):
        buttons.append([
            InlineKeyboardButton(text="📱 Открыть в приложении", web_app=WebAppInfo(url=settings.WEBAPP_URL))
        ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def get_edit_categories_kb(tx_id: str, categories: list) -> InlineKeyboardMarkup:
    buttons = []
    row = []
    for cat in categories:
        row.append(InlineKeyboardButton(text=f"{cat.icon} {cat.name}", callback_data=f"set_cat:{tx_id}:{cat.id}"))
        if len(row) == 2:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="🔙 Назад", callback_data=f"tx_back:{tx_id}")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def get_edit_accounts_kb(tx_id: str, accounts: list) -> InlineKeyboardMarkup:
    buttons = []
    for acc in accounts:
        buttons.append([
            InlineKeyboardButton(text=f"{acc.icon} {acc.name}", callback_data=f"set_acc:{tx_id}:{acc.id}")
        ])
    buttons.append([InlineKeyboardButton(text="🔙 Назад", callback_data=f"tx_back:{tx_id}")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)
