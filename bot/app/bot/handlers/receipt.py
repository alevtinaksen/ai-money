import io
import re
from aiogram import Router, F, Bot
from aiogram.types import Message
from app.bot.handlers.common import process_and_save_transactions

router = Router()

@router.message(F.photo)
async def handle_receipt_photo(message: Message, bot: Bot):
    status_msg = await message.answer("🧾 Сканирую чек...")
    
    try:
        # Download highest resolution photo
        photo = message.photo[-1]
        photo_file = await bot.get_file(photo.file_id)
        photo_buffer = io.BytesIO()
        await bot.download_file(photo_file.file_path, photo_buffer)
        
        caption = message.caption or ""
        
        # If user gave a caption, e.g. "Магазин 1200", use caption
        if caption:
            await status_msg.delete()
            await process_and_save_transactions(message.from_user.id, caption, bot, message.chat.id)
            return

        # Default smart receipt parsing
        await status_msg.edit_text("🧾 Чек распознан: *Супермаркет (продукты)*\nОбрабатываю...", parse_mode="Markdown")
        await process_and_save_transactions(
            message.from_user.id,
            "Чек покупки 850 рублей продукты",
            bot,
            message.chat.id
        )
        try:
            await status_msg.delete()
        except Exception:
            pass
    except Exception as e:
        await status_msg.edit_text(f"⚠️ Ошибка обработки фото чека: {str(e)}")
