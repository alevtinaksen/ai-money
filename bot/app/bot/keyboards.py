from typing import List
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from app.core.config import settings

def get_transaction_inline_kb(tx_id: str) -> InlineKeyboardMarkup:
    buttons = [
        [
            InlineKeyboardButton(text="✏️ Редактировать", callback_data=f"tx_edit:{tx_id}"),
            InlineKeyboardButton(text="❌ Отменить", callback_data=f"tx_del:{tx_id}"),
        ]
    ]
    if settings.WEBAPP_URL and not settings.WEBAPP_URL.startswith("http://localhost"):
        buttons.append([
            InlineKeyboardButton(text="📱 Открыть в приложении", web_app=WebAppInfo(url=settings.WEBAPP_URL))
        ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def get_edit_menu_kb(tx_id: str) -> InlineKeyboardMarkup:
    buttons = [
        [
            InlineKeyboardButton(text="💵 Сумму", callback_data=f"tx_e_amt:{tx_id}"),
            InlineKeyboardButton(text="📁 Категорию", callback_data=f"tx_edit_cat:{tx_id}"),
        ],
        [
            InlineKeyboardButton(text="💳 Счёт", callback_data=f"tx_edit_acc:{tx_id}"),
            InlineKeyboardButton(text="📝 Заметку", callback_data=f"tx_e_note:{tx_id}"),
        ],
        [
            InlineKeyboardButton(text="🔄 Изменить всё сразу", callback_data=f"tx_e_all:{tx_id}"),
        ],
        [
            InlineKeyboardButton(text="🔙 Готово", callback_data=f"tx_done:{tx_id}")
        ]
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def get_edit_amount_kb(tx_id: str, current_amount: float = 0.0) -> InlineKeyboardMarkup:
    presets = [500, 1000, 1500, 2000, 2100, 2500, 3000, 5000]
    buttons = []
    row = []
    for amt in presets:
        row.append(InlineKeyboardButton(text=f"{amt:,} ₽".replace(",", " "), callback_data=f"set_amt:{tx_id}:{amt}"))
        if len(row) == 3:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="🔙 Назад к меню", callback_data=f"tx_edit:{tx_id}")])
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
    buttons.append([InlineKeyboardButton(text="🔙 Назад к меню", callback_data=f"tx_edit:{tx_id}")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def get_edit_accounts_kb(tx_id: str, accounts: list) -> InlineKeyboardMarkup:
    buttons = []
    for acc in accounts:
        buttons.append([
            InlineKeyboardButton(text=f"{acc.icon} {acc.name} ({acc.balance:,.0f} ₽)".replace(",", " "), callback_data=f"set_acc:{tx_id}:{acc.id}")
        ])
    buttons.append([InlineKeyboardButton(text="🔙 Назад к меню", callback_data=f"tx_edit:{tx_id}")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def get_clarification_kb(pending_id: str, suggested_options: List[float]) -> InlineKeyboardMarkup:
    buttons = []
    row = []
    for opt in suggested_options:
        opt_int = int(opt) if opt.is_integer() else opt
        row.append(InlineKeyboardButton(text=f"{opt_int:,} ₽".replace(",", " "), callback_data=f"clarify:{pending_id}:{opt_int}"))
        if len(row) == 3:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="❌ Отменить", callback_data=f"cancel_clarify:{pending_id}")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def get_back_to_edit_kb(tx_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Назад к меню", callback_data=f"tx_edit:{tx_id}")]
    ])
