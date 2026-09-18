from aiogram import Router, F
from aiogram.types import CallbackQuery
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.models import Transaction, Account, Category
from app.services.finance_svc import FinanceService
from app.bot.keyboards import (
    get_transaction_inline_kb,
    get_edit_categories_kb,
    get_edit_accounts_kb
)

router = Router()

@router.callback_query(F.data.startswith("tx_del:"))
async def handle_delete_transaction(callback: CallbackQuery):
    tx_id = callback.data.split(":", 1)[1]
    user_id = callback.from_user.id

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

@router.callback_query(F.data.startswith("tx_edit_cat:"))
async def handle_open_cat_menu(callback: CallbackQuery):
    tx_id = callback.data.split(":", 1)[1]
    user_id = callback.from_user.id

    async with AsyncSessionLocal() as db:
        categories = await FinanceService.get_categories(db, user_id)
        kb = get_edit_categories_kb(tx_id, categories)
        await callback.message.edit_reply_markup(reply_markup=kb)
        await callback.answer()

@router.callback_query(F.data.startswith("tx_edit_acc:"))
async def handle_open_acc_menu(callback: CallbackQuery):
    tx_id = callback.data.split(":", 1)[1]
    user_id = callback.from_user.id

    async with AsyncSessionLocal() as db:
        accounts = await FinanceService.get_accounts(db, user_id)
        kb = get_edit_accounts_kb(tx_id, accounts)
        await callback.message.edit_reply_markup(reply_markup=kb)
        await callback.answer()

@router.callback_query(F.data.startswith("tx_back:"))
async def handle_back_menu(callback: CallbackQuery):
    tx_id = callback.data.split(":", 1)[1]
    await callback.message.edit_reply_markup(reply_markup=get_transaction_inline_kb(tx_id))
    await callback.answer()

@router.callback_query(F.data.startswith("set_cat:"))
async def handle_set_category(callback: CallbackQuery):
    _, tx_id, cat_id = callback.data.split(":")
    user_id = callback.from_user.id

    async with AsyncSessionLocal() as db:
        stmt = select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id)
        res = await db.execute(stmt)
        tx = res.scalar_one_or_none()

        stmt_cat = select(Category).where(Category.id == cat_id)
        res_cat = await db.execute(stmt_cat)
        cat = res_cat.scalar_one_or_none()

        if tx and cat:
            tx.category_id = cat.id
            await db.commit()

            stmt_acc = select(Account).where(Account.id == tx.account_id)
            res_acc = await db.execute(stmt_acc)
            acc = res_acc.scalar_one_or_none()

            type_symbol = "💸 Расход" if tx.type == "expense" else "💰 Доход"
            msg_text = (
                f"✅ **{type_symbol} обновлён:**\n\n"
                f"💵 **Сумма:** {float(tx.amount):,.2f} ₽\n"
                f"📁 **Категория:** {cat.icon} {cat.name} *(изменено)*\n"
                f"💳 **Счёт:** {acc.icon if acc else '💳'} {acc.name if acc else 'Счёт'}\n"
            )
            if tx.note:
                msg_text += f"📝 **Заметка:** {tx.note}\n"
            msg_text += f"\n*Остаток на счете: {float(acc.balance):,.2f} ₽*"

            await callback.message.edit_text(msg_text, reply_markup=get_transaction_inline_kb(tx.id), parse_mode="Markdown")
            await callback.answer(f"Категория изменена на: {cat.name}")

@router.callback_query(F.data.startswith("set_acc:"))
async def handle_set_account(callback: CallbackQuery):
    _, tx_id, target_acc_id = callback.data.split(":")
    user_id = callback.from_user.id

    async with AsyncSessionLocal() as db:
        stmt = select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id)
        res = await db.execute(stmt)
        tx = res.scalar_one_or_none()

        if tx and tx.account_id != target_acc_id:
            # 1. Revert old account balance
            stmt_old = select(Account).where(Account.id == tx.account_id)
            res_old = await db.execute(stmt_old)
            old_acc = res_old.scalar_one_or_none()

            stmt_new = select(Account).where(Account.id == target_acc_id)
            res_new = await db.execute(stmt_new)
            new_acc = res_new.scalar_one_or_none()

            if old_acc and new_acc:
                if tx.type == "expense":
                    old_acc.balance = float(old_acc.balance) + float(tx.amount)
                    new_acc.balance = float(new_acc.balance) - float(tx.amount)
                elif tx.type == "income":
                    old_acc.balance = float(old_acc.balance) - float(tx.amount)
                    new_acc.balance = float(new_acc.balance) + float(tx.amount)

                tx.account_id = new_acc.id
                await db.commit()

                stmt_cat = select(Category).where(Category.id == tx.category_id)
                res_cat = await db.execute(stmt_cat)
                cat = res_cat.scalar_one_or_none()

                type_symbol = "💸 Расход" if tx.type == "expense" else "💰 Доход"
                msg_text = (
                    f"✅ **{type_symbol} обновлён:**\n\n"
                    f"💵 **Сумма:** {float(tx.amount):,.2f} ₽\n"
                    f"📁 **Категория:** {cat.icon if cat else '📁'} {cat.name if cat else 'Без категории'}\n"
                    f"💳 **Счёт:** {new_acc.icon} {new_acc.name} *(изменено)*\n"
                )
                if tx.note:
                    msg_text += f"📝 **Заметка:** {tx.note}\n"
                msg_text += f"\n*Остаток на счете: {float(new_acc.balance):,.2f} ₽*"

                await callback.message.edit_text(msg_text, reply_markup=get_transaction_inline_kb(tx.id), parse_mode="Markdown")
                await callback.answer(f"Счёт изменен на: {new_acc.name}")
