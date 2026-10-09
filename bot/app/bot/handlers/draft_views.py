"""Telegram draft and picker presentation; no financial mutations."""
import json
from decimal import Decimal
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from app.schemas.finance import PendingClarification
from app.services.bot_drafts import draft_token
from app.services.finance_svc import FinanceService

PAGE_SIZE = 8


def format_money(value, currency):
    amount = Decimal(str(value))
    return f"{amount:,.2f}".replace(",", " ").replace(".", ",") + f" {currency}"


def edit_data(action, draft, index=None):
    value = f"draft:{action}:{draft.id.replace('-', '')}:{draft_token(draft)}"
    if index is not None:
        value += f":{index}"
    assert len(value.encode()) <= 64
    return value


def button(text, data):
    return InlineKeyboardButton(text=text, callback_data=data)


def manual_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[[
        button("💸 Ввести расход", "draft:n:expense"),
        button("💰 Ввести доход", "draft:n:income"),
    ]])


async def show_draft(message, db, draft, *, edit=False, page=0):
    accounts = await FinanceService.get_accounts(db, draft.user_id)
    categories = await FinanceService.get_categories(db, draft.user_id)
    acc_map, cat_map = {a.id: a for a in accounts}, {c.id: c for c in categories}
    data, token = json.loads(draft.payload), draft_token(draft)
    cancel = button("Отменить", f"cancel:{draft.id}:{token}")
    send = message.edit_text if edit else message.answer
    if draft.status == "clarifying":
        pending = PendingClarification.model_validate(data["pending"])
        heading = "💸 Расход" if pending.type == "expense" else "💰 Доход"
        lines = [heading + (f" · {pending.note[:200]}" if pending.note else ""), pending.question]
        manual = data.get("manual") or not pending.suggested_options
        lines.append("Пришлите только сумму. Остальные детали сохранены." if manual else
                     "Выберите сумму или пришлите только число. Остальные детали сохранены.")
        account = next((a for a in accounts if a.name == pending.account_name), None)
        account = account or next((a for a in accounts if a.is_default), accounts[0] if accounts else None)
        currency = pending.currency or (account.currency if account else "RUB")
        choices = [] if manual else [[button(format_money(amount, "₽" if currency == "RUB" else currency), edit_data("a", draft, index))]
                                    for index, amount in enumerate(pending.suggested_options)]
        if manual:
            if pending.suggested_options:
                choices.append([button("Выбрать из вариантов", edit_data("b", draft))])
            choices.append([cancel])
        else:
            choices.append([button("Указать другую сумму", edit_data("m", draft)), cancel])
        await send("\n\n".join(lines), reply_markup=InlineKeyboardMarkup(inline_keyboard=choices))
        return
    if draft.status == "editing_amount":
        await send("Пришлите новую сумму, например 5000 или 250,50. Тип, категория и заметка сохранятся.",
                   reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
                       button("Назад к черновику", edit_data("b", draft)), cancel]]))
        return
    if draft.status == "editing_category":
        ids = data["choices"]
        pages = max(1, (len(ids) + PAGE_SIZE - 1) // PAGE_SIZE)
        if page < 0 or page >= pages:
            raise ValueError("Страница категорий недоступна")
        choices = []
        for index in range(page * PAGE_SIZE, min((page + 1) * PAGE_SIZE, len(ids))):
            category = cat_map.get(ids[index])
            if ids[index] is not None and category is None:
                continue
            title = f"{category.icon} {category.name[:50]}" if category else "Без категории"
            choices.append([button(title, edit_data("c", draft, index))])
        navigation = []
        if page:
            navigation.append(button("←", edit_data("p", draft, page - 1)))
        if page + 1 < pages:
            navigation.append(button("→", edit_data("p", draft, page + 1)))
        if navigation:
            choices.append(navigation)
        choices.append([button("Назад", edit_data("b", draft)), cancel])
        await send(f"Выберите категорию · {page + 1}/{pages}\nСумма и остальные детали сохранятся.",
                   reply_markup=InlineKeyboardMarkup(inline_keyboard=choices))
        return
    if draft.status != "pending":
        await send("Это сообщение уже обработано.")
        return
    rows = data
    confirm_label = "Сохранить" if len(rows) == 1 else f"Подтвердить все ({len(rows)})"
    buttons = [[button(confirm_label, f"confirm:{draft.id}:{token}")]]
    if len(rows) == 1:
        edits = [button("Изменить сумму", edit_data("m", draft))]
        if rows[0]["type"] != "transfer":
            edits.append(button("Выбрать категорию", edit_data("k", draft)))
        buttons += [edits, [cancel]]
    else:
        buttons.append([button("Исправить запись", f"edit:{draft.id}"), cancel])
    keyboard = InlineKeyboardMarkup(inline_keyboard=buttons)
    notice = f"Подтверждение сохранит весь пакет: {len(rows)} операций. Сейчас они не записаны."
    for item in rows:
        kind = {"expense": "💸 Расход", "income": "💰 Доход", "transfer": "🔄 Перевод"}[item["type"]]
        account, category = acc_map.get(item["account_id"]), cat_map.get(item.get("category_id"))
        lines = [f"📝 Черновик: {kind}. Проверьте перед сохранением.\n",
                 f"💵 Сумма: {format_money(item['amount'], item['currency'])}",
                 f"📁 Категория: {category.icon} {category.name}" if category else
                 "📁 Категория: " + ("Недоступна — выберите другую" if item.get("category_id") else "Без категории"),
                 f"💳 Счёт: {account.icon} {account.name}" if account else "💳 Счёт: недоступен"]
        if item.get("note"):
            lines.append(f"📝 Заметка: {item['note'][:300]}")
        if account:
            lines.append(f"\nТекущий остаток: {format_money(account.balance, item['currency'])}")
        if item.get("to_account_name"):
            lines.append(f"Счёт зачисления: {item['to_account_name']}")
        if len(rows) == 1:
            await send("\n".join(lines) + "\n\n" + notice, reply_markup=keyboard)
        else:
            await message.answer("\n".join(lines))
    if len(rows) > 1:
        await send(notice, reply_markup=keyboard)
