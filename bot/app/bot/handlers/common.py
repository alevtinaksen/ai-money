from typing import List
from aiogram import Bot
from app.core.database import AsyncSessionLocal
from app.services.finance_svc import FinanceService
from app.services.ai_parser import AIParserService
from app.schemas.finance import TransactionCreate
from app.bot.keyboards import get_transaction_inline_kb

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

        # 1. Parse text via AI
        parsed = await AIParserService.parse_financial_text(text, acc_names, cat_names)

        if not parsed.transactions:
            await bot.send_message(
                chat_id=chat_id,
                text="🤔 Не удалось выделить транзакцию. Попробуйте сказать иначе, например: *«Кофе 250 с карты Альфа»* или *«Такси 400»*.",
                parse_mode="Markdown"
            )
            return

        # 2. Save each transaction and send confirmation card
        for tx_data in parsed.transactions:
            # Find matched account
            target_acc = default_acc
            if tx_data.account_name:
                for k, a in acc_dict.items():
                    if k in tx_data.account_name.lower() or tx_data.account_name.lower() in k:
                        target_acc = a
                        break

            # Find matched category
            target_cat = None
            if tx_data.category_name:
                for k, c in cat_dict.items():
                    if k in tx_data.category_name.lower() or tx_data.category_name.lower() in k:
                        target_cat = c
                        break
            if not target_cat and categories:
                target_cat = categories[0]

            # Find to_account if transfer
            target_to_acc = None
            if tx_data.type == "transfer" and tx_data.to_account_name:
                for k, a in acc_dict.items():
                    if k in tx_data.to_account_name.lower():
                        target_to_acc = a
                        break

            # Save in DB
            create_payload = TransactionCreate(
                account_id=target_acc.id,
                to_account_id=target_to_acc.id if target_to_acc else None,
                category_id=target_cat.id if target_cat else None,
                amount=tx_data.amount,
                type=tx_data.type,
                note=tx_data.note
            )

            saved_tx = await FinanceService.create_transaction(db, user_id, create_payload)

            # Format response message
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
