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

def get_edit_menu_kb() -> InlineKeyboardMarkup:
    buttons = [
        [
            InlineKeyboardButton(text="💵 Сумму", callback_data="tx_e_amt"),
            InlineKeyboardButton(text="📁 Категорию", callback_data="tx_edit_cat"),
        ],
        [
            InlineKeyboardButton(text="💳 Счёт", callback_data="tx_edit_acc"),
            InlineKeyboardButton(text="📝 Заметку", callback_data="tx_e_note"),
        ],
        [
            InlineKeyboardButton(text="🔄 Изменить всё сразу", callback_data="tx_e_all"),
        ],
        [
            InlineKeyboardButton(text="🔙 Готово", callback_data="tx_done")
        ]
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def get_edit_amount_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Назад к меню", callback_data="tx_edit_menu")]
    ])

def get_edit_categories_kb(categories: list) -> InlineKeyboardMarkup:
    buttons = []
    row = []
    for cat in categories:
        row.append(InlineKeyboardButton(text=f"{cat.icon} {cat.name}", callback_data=f"sc:{cat.id}"))
        if len(row) == 2:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="🔙 Назад к меню", callback_data="tx_edit_menu")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def get_edit_accounts_kb(accounts: list) -> InlineKeyboardMarkup:
    buttons = []
    for acc in accounts:
        buttons.append([
            InlineKeyboardButton(
                text=f"{acc.icon} {acc.name} ({acc.balance:,.0f} ₽)".replace(",", " "),
                callback_data=f"sa:{acc.id}"
            )
        ])
    buttons.append([InlineKeyboardButton(text="🔙 Назад к меню", callback_data="tx_edit_menu")])
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

def get_back_to_edit_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Назад к меню", callback_data="tx_edit_menu")]
    ])
