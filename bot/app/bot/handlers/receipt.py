import io
import re
from aiogram import Router, F, Bot
from aiogram.types import Message
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.models import Account, Category
from app.services.finance_svc import FinanceService
from app.services.ai_parser import AIParserService
from app.services.ocr_service import OCRService
from app.schemas.finance import TransactionCreate
from app.bot.keyboards import get_transaction_inline_kb
from app.bot.handlers.common import (
    format_category_display,
    update_user_mini_app_sync,
    process_and_save_transactions
)

router = Router()

@router.message(F.photo)
async def handle_receipt_photo(message: Message, bot: Bot):
    status_msg = await message.answer("🧾 Анализирую чек / скриншот...")

    try:
        # Download highest resolution photo
        photo = message.photo[-1]
        photo_file = await bot.get_file(photo.file_id)
        photo_buffer = io.BytesIO()
        await bot.download_file(photo_file.file_path, photo_buffer)
        image_bytes = photo_buffer.getvalue()

        caption = (message.caption or "").strip()
        user_id = message.from_user.id

        async with AsyncSessionLocal() as db:
            await FinanceService.ensure_user_seeded(db, user_id)
            accounts = await FinanceService.get_accounts(db, user_id)
            categories = await FinanceService.get_categories(db, user_id)

            acc_names = [a.name for a in accounts]
            cat_names = [c.name for c in categories]
            acc_dict = {a.name.lower(): a for a in accounts}
            cat_dict = {c.name.lower(): c for c in categories}
            default_acc = await FinanceService.get_default_account(db, user_id)

            # Use OCR Service to extract transactions
            transactions = OCRService.parse_transactions(
                image_bytes=image_bytes,
                caption=caption,
                account_names=acc_names,
                category_names=cat_names
            )

            # If OCR extracted transactions from image
            if transactions:
                saved_records = []
                total_amount = 0.0
                target_account = None

                for tx_data in transactions:
                    # Match account
                    acc = None
                    if tx_data.account_name:
                        matched_name = AIParserService.match_account_name(tx_data.account_name, acc_names)
                        if matched_name and matched_name.lower() in acc_dict:
                            acc = acc_dict[matched_name.lower()]
                        else:
                            for k, a in acc_dict.items():
                                if k in tx_data.account_name.lower() or tx_data.account_name.lower() in k:
                                    acc = a
                                    break
                    if not acc:
                        acc = default_acc
                    target_account = acc

                    # Match category
                    cat = None
                    if tx_data.category_name:
                        for k, c in cat_dict.items():
                            if k in tx_data.category_name.lower() or tx_data.category_name.lower() in k:
                                cat = c
                                break
                    if not cat and categories:
                        cat = categories[0]

                    create_payload = TransactionCreate(
                        account_id=acc.id,
                        to_account_id=None,
                        category_id=cat.id if cat else None,
                        amount=tx_data.amount,
                        type=tx_data.type,
                        note=tx_data.note
                    )
                    saved = await FinanceService.create_transaction(db, user_id, create_payload)
                    saved_records.append((saved, acc, cat, tx_data))
                    total_amount += tx_data.amount

                sync_hash = await update_user_mini_app_sync(bot, message.chat.id, user_id, db)

                # Format response card
                if len(saved_records) == 1:
                    saved, acc, cat, tx_data = saved_records[0]
                    cat_line = format_category_display(cat.name if cat else None, cat.icon if cat else None, tx_data.note)
                    msg_text = (
                        f"✅ **💸 Расход записан по фото:**\n\n"
                        f"💵 **Сумма:** {tx_data.amount:,.2f} ₽\n"
                        f"📁 **Категория:** {cat_line}\n"
                        f"💳 **Счёт:** {acc.icon} {acc.name}\n"
                    )
                    if tx_data.note:
                        msg_text += f"📝 **Заметка:** {tx_data.note}\n"
                    msg_text += f"\n*Остаток на счете: {float(acc.balance):,.2f} ₽*"

                    try:
                        await status_msg.delete()
                    except Exception:
                        pass

                    await bot.send_message(
                        chat_id=message.chat.id,
                        text=msg_text,
                        reply_markup=get_transaction_inline_kb(saved.id, sync_hash),
                        parse_mode="Markdown"
                    )
                else:
                    items_text = []
                    num_icons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]
                    for idx, (saved, acc, cat, tx_data) in enumerate(saved_records):
                        num_ico = num_icons[idx] if idx < len(num_icons) else f"{idx+1}."
                        cat_line = format_category_display(cat.name if cat else None, cat.icon if cat else None, tx_data.note)
                        items_text.append(f"{num_ico} **{tx_data.note or 'Покупка'}:** {tx_data.amount:,.2f} ₽\n    └ {cat_line}")

                    acc_name = target_account.name if target_account else "Основной"
                    acc_icon = target_account.icon if target_account else "💳"
                    acc_balance = float(target_account.balance) if target_account else 0.0

                    msg_text = (
                        f"🧾 **Распознано и записано {len(saved_records)} покупок:**\n\n"
                        + "\n\n".join(items_text)
                        + f"\n\n💳 **Счёт:** {acc_icon} {acc_name}\n"
                        f"💵 **Итого:** {total_amount:,.2f} ₽\n"
                        f"*Остаток на счете: {acc_balance:,.2f} ₽*"
                    )

                    try:
                        await status_msg.delete()
                    except Exception:
                        pass

                    last_saved_id = saved_records[-1][0].id
                    await bot.send_message(
                        chat_id=message.chat.id,
                        text=msg_text,
                        reply_markup=get_transaction_inline_kb(last_saved_id, sync_hash),
                        parse_mode="Markdown"
                    )
                return

        # Fallback: if caption was provided, use caption parser
        if caption:
            try:
                await status_msg.delete()
            except Exception:
                pass
            await process_and_save_transactions(user_id, caption, bot, message.chat.id)
            return

        # If nothing could be recognized
        await status_msg.edit_text(
            "🤔 Не удалось распознать траты на чеке или скриншоте.\n"
            "Попробуйте отправить фото с подписью (например: *«С общей карты на еду спиши эти покупки»* или *«Пятерочка 1200»*).",
            parse_mode="Markdown"
        )

    except Exception as e:
        await status_msg.edit_text(f"⚠️ Ошибка обработки фото: {str(e)}")
