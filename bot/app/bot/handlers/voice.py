import io
from aiogram import Router, F, Bot
from aiogram.types import Message
from app.services.ai_parser import AIParserService
from app.bot.handlers.common import process_and_save_transactions

router = Router()

@router.message(F.voice)
async def handle_voice_message(message: Message, bot: Bot):
    status_msg = await message.answer("🎙️ Распознаю голос...")
    
    try:
        # Download voice file
        voice_file = await bot.get_file(message.voice.file_id)
        voice_buffer = io.BytesIO()
        await bot.download_file(voice_file.file_path, voice_buffer)
        voice_bytes = voice_buffer.getvalue()

        # Transcribe with Groq Whisper
        transcribed_text = await AIParserService.transcribe_audio(voice_bytes, filename="voice.ogg")

        if not transcribed_text:
            await status_msg.edit_text("❌ Не удалось распознать речь в голосовом сообщении. Попробуйте еще раз или напишите текстом.")
            return

        await status_msg.edit_text(f"🗣️ *«{transcribed_text}»*\nОбрабатываю...", parse_mode="Markdown")
        await process_and_save_transactions(message.from_user.id, transcribed_text, bot, message.chat.id)
        
        # Remove processing message
        try:
            await status_msg.delete()
        except Exception:
            pass

    except Exception as e:
        await status_msg.edit_text(f"⚠️ Ошибка обработки аудио: {str(e)}")
