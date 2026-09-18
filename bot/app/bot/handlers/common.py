import re
import uuid
from typing import List, Optional
from aiogram import Bot
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.models import Transaction, Account, Category
from app.services.finance_svc import FinanceService
from app.services.ai_parser import AIParserService
from app.schemas.finance import TransactionCreate
from app.bot.keyboards import get_transaction_inline_kb, get_clarification_kb
from app.bot.state import (
    set_pending_clarification,
    clear_pending_clarification,
    get_user_active_pending,
    get_user_edit,
    clear_user_edit,
    USER_ACTIVE_PENDING
)

async def handle_user_input(user_id: int, text: str, bot: Bot, chat_id: int):
    """Unified entry point for both text and voice transcribed messages."""
    clean_text = text.strip()
    if not clean_text:
        return

    # 1. Check if user is responding to an active pending clarification
    pending = get_user_active_pending(user_id)
    if pending:
        norm = AIParserService.normalize_speech_numbers(clean_text)
        amt_match = re.search(r"(\d+(?:\.\d+)?)", norm.replace(",", "."))
        if amt_match:
            amount = float(amt_match.group(1))
            pending_id = USER_ACTIVE_PENDING.get(user_id)
            if pending_id:
                await complete_clarification(bot, chat_id, user_id, pending_id, amount)
                return

    # 2. Check if user is responding to an active edit prompt
    edit_state = get_user_edit(user_id)
    if edit_state:
        action = edit_state.get("action")
        tx_id = edit_state.get("tx_id")
        norm = AIParserService.normalize_speech_numbers(clean_text)

        async with AsyncSessionLocal() as db:
            if action == "edit_amount":
                amt_match = re.search(r"(\d+(?:\.\d+)?)", norm.replace(",", "."))
                if amt_match:
                    amount = float(amt_match.group(1))
                    updated = await FinanceService.update_transaction(db, user_id, tx_id, {"amount": amount})
                    clear_user_edit(user_id)
                    if updated:
                        await send_updated_tx_card(bot, chat_id, user_id, updated, "Сумма изменена")
                        return

            elif action == "edit_note":
                updated = await FinanceService.update_transaction(db, user_id, tx_id, {"note": clean_text})
                clear_user_edit(user_id)
                if updated:
                    await send_updated_tx_card(bot, chat_id, user_id, updated, "Заметка изменена")
                    return

            elif action == "edit_all":
                accounts = await FinanceService.get_accounts(db, user_id)
                categories = await FinanceService.get_categories(db, user_id)
                acc_names = [a.name for a in accounts]
                cat_names = [c.name for c in categories]
                parsed = await AIParserService.parse_financial_text(clean_text, acc_names, cat_names)

                if parsed.transactions:
                    tx_data = parsed.transactions[0]
                    target_acc_id = None
                    for a in accounts:
                        if tx_data.account_name and (a.name.lower() in tx_data.account_name.lower() or tx_data.account_name.lower() in a.name.lower()):
                            target_acc_id = a.id
                            break
                    target_cat_id = None
                    for c in categories:
                        if tx_data.category_name and (c.name.lower() in tx_data.category_name.lower() or tx_data.category_name.lower() in c.name.lower()):
                            target_cat_id = c.id
                            break

                    update_dict = {"amount": tx_data.amount, "type": tx_data.type, "note": tx_data.note}
                    if target_acc_id:
                        update_dict["account_id"] = target_acc_id
                    if target_cat_id:
                        update_dict["category_id"] = target_cat_id

                    updated = await FinanceService.update_transaction(db, user_id, tx_id, update_dict)
                    clear_user_edit(user_id)
                    if updated:
                        await send_updated_tx_card(bot, chat_id, user_id, updated, "Запись обновлена")
                        return

        clear_user_edit(user_id)

    # 3. Normal flow: parse and save transaction(s)
    await process_and_save_transactions(user_id, clean_text, bot, chat_id)

async def process_and_save_transactions(user_id: int, text: str, bot: Bot, chat_id: int):
    async with AsyncSessionLocal() as db:
        await FinanceService.ensure_user_seeded(db, user_id)
        accounts = await FinanceService.get_accounts(db, user_id)
        categories = await FinanceService.get_categories(db, user_id)

        acc_names = [a.name for a in accounts]
        cat_names = [c.name for c in categories]
        acc_dict = {a.name.lower(): a for a in accounts}
        cat_dict = {c.name.lower(): c for c in categories}
        default_acc = await FinanceService.get_default_account(db, user_id)

        # 1. Parse text via AI / Heuristic with speech normalization
        parsed = await AIParserService.parse_financial_text(text, acc_names, cat_names)

        # 2. Check for clarification / missing amount
        if parsed.pending:
            pending_id = uuid.uuid4().hex[:8]
            target_acc = default_acc
            if parsed.pending.account_name:
                for k, a in acc_dict.items():
                    if k in parsed.pending.account_name.lower():
                        target_acc = a
                        break

            target_cat = categories[0] if categories else None
            if parsed.pending.category_name:
                for k, c in cat_dict.items():
                    if k in parsed.pending.category_name.lower():
                        target_cat = c
                        break

            pending_data = {
                "user_id": user_id,
                "note": parsed.pending.note or "Трата",
                "type": parsed.pending.type or "expense",
                "category_id": target_cat.id if target_cat else None,
                "category_name": target_cat.name if target_cat else "Без категории",
                "category_icon": target_cat.icon if target_cat else "📦",
                "account_id": target_acc.id if target_acc else None,
                "account_name": target_acc.name if target_acc else "Счёт",
                "account_icon": target_acc.icon if target_acc else "💳",
            }
            set_pending_clarification(pending_id, user_id, pending_data)

            kb = get_clarification_kb(pending_id, parsed.pending.suggested_options)
            msg = (
                f"{parsed.pending.question}\n\n"
                f"📁 **Категория:** {pending_data['category_icon']} {pending_data['category_name']}\n"
                f"💳 **Счёт:** {pending_data['account_icon']} {pending_data['account_name']}\n\n"
                f"👉 *Выберите сумму кнопкой или просто напишите / скажите её в чат:*"
            )
            await bot.send_message(chat_id=chat_id, text=msg, reply_markup=kb, parse_mode="Markdown")
            return

        if not parsed.transactions:
            await bot.send_message(
                chat_id=chat_id,
                text="🤔 Не удалось распознать сумму или транзакцию. Попробуйте сказать иначе, например: *«Кофе 250 с карты Альфа»* или *«Такси 400»*.",
                parse_mode="Markdown"
            )
            return

        # 3. Save each transaction and send confirmation card
        for tx_data in parsed.transactions:
            target_acc = default_acc
            if tx_data.account_name:
                for k, a in acc_dict.items():
                    if k in tx_data.account_name.lower() or tx_data.account_name.lower() in k:
                        target_acc = a
                        break

            target_cat = None
            if tx_data.category_name:
                for k, c in cat_dict.items():
                    if k in tx_data.category_name.lower() or tx_data.category_name.lower() in k:
                        target_cat = c
                        break
            if not target_cat and categories:
                target_cat = categories[0]

            target_to_acc = None
            if tx_data.type == "transfer" and tx_data.to_account_name:
                for k, a in acc_dict.items():
                    if k in tx_data.to_account_name.lower():
                        target_to_acc = a
                        break

            create_payload = TransactionCreate(
                account_id=target_acc.id,
                to_account_id=target_to_acc.id if target_to_acc else None,
                category_id=target_cat.id if target_cat else None,
                amount=tx_data.amount,
                type=tx_data.type,
                note=tx_data.note
            )

            saved_tx = await FinanceService.create_transaction(db, user_id, create_payload)

            type_symbol = "💸 Расход" if tx_data.type == "expense" else ("💰 Доход" if tx_data.type == "income" else "🔄 Перевод")
            acc_icon = target_acc.icon if target_acc else "💳"
            cat_icon = target_cat.icon if target_cat else "📦"

            msg_text = (
                f"✅ **{type_symbol} записан:**\n\n"
                f"💵 **Сумма:** {tx_data.amount:,.2f} ₽\n"
                f"📁 **Категория:** {cat_icon} {target_cat.name if target_cat else 'Без категории'}\n"
                f"💳 **Счёт:** {acc_icon} {target_acc.name if target_acc else 'Основной'}\n"
            )
            if tx_data.note:
                msg_text += f"📝 **Заметка:** {tx_data.note}\n"

            msg_text += f"\n*Остаток на счете: {float(target_acc.balance):,.2f} ₽*"

            await bot.send_message(
                chat_id=chat_id,
                text=msg_text,
                reply_markup=get_transaction_inline_kb(saved_tx.id),
                parse_mode="Markdown"
            )

async def complete_clarification(bot: Bot, chat_id: int, user_id: int, pending_id: str, amount: float, message_to_edit_id: Optional[int] = None):
    """Completes a pending clarification with the given amount."""
    from app.bot.state import get_pending_clarification, clear_pending_clarification
    pending_data = get_pending_clarification(pending_id)
    if not pending_data:
        return

    async with AsyncSessionLocal() as db:
        create_payload = TransactionCreate(
            account_id=pending_data["account_id"],
            category_id=pending_data.get("category_id"),
            amount=amount,
            type=pending_data.get("type", "expense"),
            note=pending_data.get("note")
        )
        saved_tx = await FinanceService.create_transaction(db, user_id, create_payload)
        clear_pending_clarification(pending_id)

        # Get fresh account balance
        accounts = await FinanceService.get_accounts(db, user_id)
        acc_dict = {a.id: a for a in accounts}
        target_acc = acc_dict.get(pending_data["account_id"])

        type_symbol = "💸 Расход" if create_payload.type == "expense" else "💰 Доход"
        msg_text = (
            f"✅ **{type_symbol} записан:**\n\n"
            f"💵 **Сумма:** {amount:,.2f} ₽\n"
            f"📁 **Категория:** {pending_data.get('category_icon', '📦')} {pending_data.get('category_name', 'Без категории')}\n"
            f"💳 **Счёт:** {pending_data.get('account_icon', '💳')} {pending_data.get('account_name', 'Счёт')}\n"
        )
        if pending_data.get("note"):
            msg_text += f"📝 **Заметка:** {pending_data['note']}\n"
        if target_acc:
            msg_text += f"\n*Остаток на счете: {float(target_acc.balance):,.2f} ₽*"

        if message_to_edit_id:
            try:
                await bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=message_to_edit_id,
                    text=msg_text,
                    reply_markup=get_transaction_inline_kb(saved_tx.id),
                    parse_mode="Markdown"
                )
                return
            except Exception:
                pass

        await bot.send_message(
            chat_id=chat_id,
            text=msg_text,
            reply_markup=get_transaction_inline_kb(saved_tx.id),
            parse_mode="Markdown"
        )

async def send_updated_tx_card(bot: Bot, chat_id: int, user_id: int, tx: Transaction, prefix: str = "Обновлено"):
    async with AsyncSessionLocal() as db:
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
            f"✅ **{type_symbol} ({prefix}):**\n\n"
            f"💵 **Сумма:** {float(tx.amount):,.2f} ₽\n"
            f"📁 **Категория:** {cat_icon} {cat_name}\n"
            f"💳 **Счёт:** {acc_icon} {acc_name}\n"
        )
        if tx.note:
            msg_text += f"📝 **Заметка:** {tx.note}\n"
        if acc:
            msg_text += f"\n*Остаток на счете: {float(acc.balance):,.2f} ₽*"

        await bot.send_message(
            chat_id=chat_id,
            text=msg_text,
            reply_markup=get_transaction_inline_kb(tx.id),
            parse_mode="Markdown"
        )
