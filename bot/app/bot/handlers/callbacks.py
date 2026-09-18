from aiogram import Router, F
from aiogram.types import CallbackQuery
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.models import Transaction, Account, Category
from app.services.finance_svc import FinanceService
from app.bot.keyboards import (
    get_transaction_inline_kb,
    get_edit_menu_kb,
    get_edit_amount_kb,
    get_edit_categories_kb,
    get_edit_accounts_kb,
    get_back_to_edit_kb
)
from app.bot.state import (
    set_user_edit,
    clear_user_edit,
    set_active_edit_tx,
    get_active_edit_tx,
    clear_active_edit_tx,
    clear_pending_clarification
)
from app.bot.handlers.common import complete_clarification

router = Router()

async def render_tx_card_text(db, user_id: int, tx: Transaction) -> str:
    stmt_acc = select(Account).where(Account.id == tx.account_id)
    res_acc = await db.execute(stmt_acc)
    acc = res_acc.scalar_one_or_none()

    stmt_cat = select(Category).where(Category.id == tx.category_id)
    res_cat = await db.execute(stmt_cat)
    cat = res_cat.scalar_one_or_none()

    type_symbol = "💸 Расход" if tx.type == "expense" else ("💰 Доход" if tx.type == "income" else "🔄 Перевод")
    acc_icon = acc.icon if acc else "💳"
    cat_icon = cat.icon if cat else "📦"
    acc_name = acc.name if acc else "Счёт"
    cat_name = cat.name if cat else "Без категории"

    msg_text = (
        f"✅ **{type_symbol} записан:**\n\n"
        f"💵 **Сумма:** {float(tx.amount):,.2f} ₽\n"
        f"📁 **Категория:** {cat_icon} {cat_name}\n"
        f"💳 **Счёт:** {acc_icon} {acc_name}\n"
    )
    if tx.note:
        msg_text += f"📝 **Заметка:** {tx.note}\n"
    if acc:
        msg_text += f"\n*Остаток на счете: {float(acc.balance):,.2f} ₽*"
    return msg_text

async def render_edit_menu_text(db, user_id: int, tx: Transaction) -> str:
    stmt_acc = select(Account).where(Account.id == tx.account_id)
    res_acc = await db.execute(stmt_acc)
    acc = res_acc.scalar_one_or_none()

    stmt_cat = select(Category).where(Category.id == tx.category_id)
    res_cat = await db.execute(stmt_cat)
    cat = res_cat.scalar_one_or_none()

    acc_icon = acc.icon if acc else "💳"
    cat_icon = cat.icon if cat else "📦"
    acc_name = acc.name if acc else "Счёт"
    cat_name = cat.name if cat else "Без категории"

    return (
        f"✏️ **Редактирование операции:**\n\n"
        f"💵 **Сумма:** {float(tx.amount):,.2f} ₽\n"
        f"📁 **Категория:** {cat_icon} {cat_name}\n"
        f"💳 **Счёт:** {acc_icon} {acc_name}\n"
        f"📝 **Заметка:** {tx.note or '—'}\n\n"
        f"👇 *Выберите, что хотите изменить:*"
    )

@router.callback_query(F.data.startswith("tx_del:"))
async def handle_delete_transaction(callback: CallbackQuery):
    tx_id = callback.data.split(":", 1)[1]
    user_id = callback.from_user.id
    clear_user_edit(user_id)
    clear_active_edit_tx(user_id)

    async with AsyncSessionLocal() as db:
        success = await FinanceService.delete_transaction(db, user_id, tx_id)
        if success:
            await callback.answer("Запись удалена, баланс возвращён!", show_alert=False)
            await callback.message.edit_text(
                "❌ **Запись отменена и удалена**\nСумма возвращена на счёт.",
                parse_mode="Markdown"
            )
        else:
            await callback.answer("Запись уже была удалена или не найдена.", show_alert=True)

@router.callback_query(F.data.startswith("tx_edit:"))
async def handle_open_edit_menu(callback: CallbackQuery):
    tx_id = callback.data.split(":", 1)[1]
    user_id = callback.from_user.id
    clear_user_edit(user_id)
    set_active_edit_tx(user_id, tx_id)

    async with AsyncSessionLocal() as db:
        stmt = select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id)
        res = await db.execute(stmt)
        tx = res.scalar_one_or_none()
        if not tx:
            await callback.answer("Запись не найдена", show_alert=True)
            return

        text = await render_edit_menu_text(db, user_id, tx)
        await callback.message.edit_text(text, reply_markup=get_edit_menu_kb(), parse_mode="Markdown")
        await callback.answer()

@router.callback_query(F.data == "tx_edit_menu")
async def handle_back_to_edit_menu(callback: CallbackQuery):
    user_id = callback.from_user.id
    clear_user_edit(user_id)
    tx_id = get_active_edit_tx(user_id)
    if not tx_id:
        await callback.answer("Сессия редактирования истекла", show_alert=True)
        return

    async with AsyncSessionLocal() as db:
        stmt = select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id)
        res = await db.execute(stmt)
        tx = res.scalar_one_or_none()
        if not tx:
            await callback.answer("Запись не найдена", show_alert=True)
            return

        text = await render_edit_menu_text(db, user_id, tx)
        await callback.message.edit_text(text, reply_markup=get_edit_menu_kb(), parse_mode="Markdown")
        await callback.answer()

@router.callback_query(F.data == "tx_done")
async def handle_finish_edit(callback: CallbackQuery):
    user_id = callback.from_user.id
    tx_id = get_active_edit_tx(user_id)
    clear_user_edit(user_id)
    clear_active_edit_tx(user_id)

    if not tx_id:
        await callback.answer("Готово!")
        return

    async with AsyncSessionLocal() as db:
        stmt = select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id)
        res = await db.execute(stmt)
        tx = res.scalar_one_or_none()
        if not tx:
            await callback.answer("Запись не найдена", show_alert=True)
            return

        text = await render_tx_card_text(db, user_id, tx)
        await callback.message.edit_text(text, reply_markup=get_transaction_inline_kb(tx_id), parse_mode="Markdown")
        await callback.answer("Изменения сохранены!")

@router.callback_query(F.data == "tx_e_amt")
async def handle_open_amt_menu(callback: CallbackQuery):
    user_id = callback.from_user.id
    tx_id = get_active_edit_tx(user_id)
    if not tx_id:
        await callback.answer("Сессия истекла", show_alert=True)
        return

    async with AsyncSessionLocal() as db:
        stmt = select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id)
        res = await db.execute(stmt)
        tx = res.scalar_one_or_none()
        if not tx:
            await callback.answer("Запись не найдена", show_alert=True)
            return

        set_user_edit(user_id, "edit_amount", tx_id, callback.message.message_id, callback.message.chat.id)
        kb = get_edit_amount_kb()
        text = (
            f"💵 **Изменение суммы:**\n"
            f"Текущая сумма: **{float(tx.amount):,.2f} ₽**\n\n"
            f"👉 Напишите новую сумму числом или отправьте её **голосовым сообщением в чат**:"
        )
        await callback.message.edit_text(text, reply_markup=kb, parse_mode="Markdown")
        await callback.answer()

@router.callback_query(F.data == "tx_edit_cat")
async def handle_open_cat_menu(callback: CallbackQuery):
    user_id = callback.from_user.id
    clear_user_edit(user_id)

    async with AsyncSessionLocal() as db:
        categories = await FinanceService.get_categories(db, user_id)
        kb = get_edit_categories_kb(categories)
        await callback.message.edit_text(
            "📁 **Выберите новую категорию:**",
            reply_markup=kb,
            parse_mode="Markdown"
        )
        await callback.answer()

@router.callback_query(F.data.startswith("sc:"))
async def handle_set_category(callback: CallbackQuery):
    cat_id = callback.data.split(":", 1)[1]
    user_id = callback.from_user.id
    clear_user_edit(user_id)
    tx_id = get_active_edit_tx(user_id)
    if not tx_id:
        await callback.answer("Сессия истекла", show_alert=True)
        return

    async with AsyncSessionLocal() as db:
        updated = await FinanceService.update_transaction(db, user_id, tx_id, {"category_id": cat_id})
        if not updated:
            await callback.answer("Ошибка обновления", show_alert=True)
            return

        text = await render_edit_menu_text(db, user_id, updated)
        await callback.message.edit_text(text, reply_markup=get_edit_menu_kb(), parse_mode="Markdown")
        await callback.answer("Категория обновлена!")

@router.callback_query(F.data == "tx_edit_acc")
async def handle_open_acc_menu(callback: CallbackQuery):
    user_id = callback.from_user.id
    clear_user_edit(user_id)

    async with AsyncSessionLocal() as db:
        accounts = await FinanceService.get_accounts(db, user_id)
        kb = get_edit_accounts_kb(accounts)
        await callback.message.edit_text(
            "💳 **Выберите счёт для списания:**",
            reply_markup=kb,
            parse_mode="Markdown"
        )
        await callback.answer()

@router.callback_query(F.data.startswith("sa:"))
async def handle_set_account(callback: CallbackQuery):
    target_acc_id = callback.data.split(":", 1)[1]
    user_id = callback.from_user.id
    clear_user_edit(user_id)
    tx_id = get_active_edit_tx(user_id)
    if not tx_id:
        await callback.answer("Сессия истекла", show_alert=True)
        return

    async with AsyncSessionLocal() as db:
        updated = await FinanceService.update_transaction(db, user_id, tx_id, {"account_id": target_acc_id})
        if not updated:
            await callback.answer("Ошибка обновления", show_alert=True)
            return

        text = await render_edit_menu_text(db, user_id, updated)
        await callback.message.edit_text(text, reply_markup=get_edit_menu_kb(), parse_mode="Markdown")
        await callback.answer("Счёт обновлен!")

@router.callback_query(F.data == "tx_e_note")
async def handle_prompt_note(callback: CallbackQuery):
    user_id = callback.from_user.id
    tx_id = get_active_edit_tx(user_id)
    if not tx_id:
        await callback.answer("Сессия истекла", show_alert=True)
        return

    async with AsyncSessionLocal() as db:
        stmt = select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id)
        res = await db.execute(stmt)
        tx = res.scalar_one_or_none()
        if not tx:
            await callback.answer("Запись не найдена", show_alert=True)
            return

        set_user_edit(user_id, "edit_note", tx_id, callback.message.message_id, callback.message.chat.id)
        text = (
            f"📝 **Изменение заметки:**\n"
            f"Текущая заметка: *«{tx.note or '—'}»*\n\n"
            f"👉 Напишите новую заметку сообщением в чат или отправьте её голосовым:"
        )
        await callback.message.edit_text(text, reply_markup=get_back_to_edit_kb(), parse_mode="Markdown")
        await callback.answer()

@router.callback_query(F.data == "tx_e_all")
async def handle_prompt_all(callback: CallbackQuery):
    user_id = callback.from_user.id
    tx_id = get_active_edit_tx(user_id)
    if not tx_id:
        await callback.answer("Сессия истекла", show_alert=True)
        return

    set_user_edit(user_id, "edit_all", tx_id, callback.message.message_id, callback.message.chat.id)
    text = (
        f"🔄 **Полное изменение записи:**\n\n"
        f"👉 Продиктуйте голосом или напишите полностью новые данные.\n"
        f"Например: *«Маникюр 2500 с карты Т-Банк»* или *«Обед 450 наличными»*"
    )
    await callback.message.edit_text(text, reply_markup=get_back_to_edit_kb(), parse_mode="Markdown")
    await callback.answer()

@router.callback_query(F.data.startswith("clarify:"))
async def handle_clarify_choice(callback: CallbackQuery):
    _, pending_id, amt_str = callback.data.split(":")
    user_id = callback.from_user.id
    amount = float(amt_str)

    await complete_clarification(
        bot=callback.bot,
        chat_id=callback.message.chat.id,
        user_id=user_id,
        pending_id=pending_id,
        amount=amount,
        message_to_edit_id=callback.message.message_id
    )
    await callback.answer("Сумма подтверждена!")

@router.callback_query(F.data.startswith("cancel_clarify:"))
async def handle_cancel_clarify(callback: CallbackQuery):
    pending_id = callback.data.split(":", 1)[1]
    clear_pending_clarification(pending_id)
    await callback.message.edit_text("❌ **Запись отменена**", parse_mode="Markdown")
    await callback.answer("Отменено")
