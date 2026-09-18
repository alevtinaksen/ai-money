import io
import re
import json
import logging
from typing import List, Optional
from app.core.config import settings
from app.schemas.finance import AIParsedResult, AIParsedTransaction

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = """Ты — интеллектуальный финансовый ассистент личного бюджета.
Твоя задача — извлечь транзакции из текста пользователя на русском языке и вернуть структурированный JSON.

Доступные счета пользователя:
{accounts_list}

Доступные категории расходов:
{categories_list}

Правила:
1. Выдели все упомянутые финансовые операции. Если пользователь назвал несколько трат («Кофе 200 и аптека 1500»), верни массив объектов transactions.
2. Определи:
   - amount: число (float), сумма операции.
   - type: 'expense' (расход), 'income' (доход), или 'transfer' (перевод между счетами).
   - category_name: выбери наиболее подходящую категорию из списка доступных категорий. Если подходящей нет, напиши понятное название категории.
   - account_name: если упомянут счёт («с Альфы», «по Т-Банку», «наличкой»), сопоставь с доступными счетами. Если не упомянут, оставь null или укажи основной счёт.
   - to_account_name: если это перевод (например, «перевел 5000 с Альфы на Накопительный»), укажи счет зачисления.
   - note: краткое описание покупки или действия («Кофе», «Аптека», «Зарплата», «Такси»).

Верни ответ СТРОГО в формате JSON:
{{
  "transactions": [
    {{
      "amount": 250.0,
      "type": "expense",
      "category_name": "Еда",
      "account_name": "Карта Альфа",
      "to_account_name": null,
      "note": "Кофе"
    }}
  ],
  "clarification": null
}}
"""

class AIParserService:
    @staticmethod
    async def transcribe_audio(audio_bytes: bytes, filename: str = "voice.ogg") -> str:
        """
        Transcribes audio using Groq Whisper Large v3 if key is present,
        or falls back to zero-config speech recognition.
        """
        # 1. Try Groq Whisper if API key is provided
        if settings.GROQ_API_KEY:
            try:
                from groq import AsyncGroq
                client = AsyncGroq(api_key=settings.GROQ_API_KEY)
                file_tuple = (filename, audio_bytes, "audio/ogg")
                transcription = await client.audio.transcriptions.create(
                    file=file_tuple,
                    model="whisper-large-v3",
                    response_format="json",
                    language="ru",
                    temperature=0.0
                )
                if transcription.text:
                    return transcription.text.strip()
            except Exception as e:
                logger.error(f"Groq Whisper transcription failed: {e}. Falling back...")

        # 2. Fallback: Free SpeechRecognition via pydub & ffmpeg (requires NO API KEY)
        try:
            import io
            import speech_recognition as sr
            from pydub import AudioSegment

            audio_seg = AudioSegment.from_file(io.BytesIO(audio_bytes))
            wav_io = io.BytesIO()
            audio_seg.export(wav_io, format="wav")
            wav_io.seek(0)

            recognizer = sr.Recognizer()
            with sr.AudioFile(wav_io) as source:
                audio_data = recognizer.record(source)
                text = recognizer.recognize_google(audio_data, language="ru-RU")
                if text:
                    logger.info(f"Successfully transcribed via speech_recognition: {text}")
                    return text.strip()
        except Exception as e:
            logger.error(f"Fallback speech recognition error: {e}")

        return ""

    @staticmethod
    async def parse_financial_text(
        text: str,
        account_names: List[str],
        category_names: List[str]
    ) -> AIParsedResult:
        """Parses raw text into structured transactions using Groq Llama 3.3 70B or fallback."""
        if not text.strip():
            return AIParsedResult(transactions=[])

        # If Groq API key is present, use Llama 3.3 70B
        if settings.GROQ_API_KEY:
            try:
                from groq import AsyncGroq
                client = AsyncGroq(api_key=settings.GROQ_API_KEY)

                system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
                    accounts_list=", ".join(account_names) if account_names else "Карта Альфа, Т-Банк, Наличные",
                    categories_list=", ".join(category_names) if category_names else "Еда, Транспорт, Покупки, Развлечения, Здоровье"
                )

                chat_completion = await client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": text}
                    ],
                    model="llama-3.3-70b-versatile",
                    response_format={"type": "json_object"},
                    temperature=0.1
                )

                content = chat_completion.choices[0].message.content
                data = json.loads(content)
                return AIParsedResult(**data)
            except Exception as e:
                logger.error(f"Error in Groq LLM parsing: {e}. Falling back to rule-based parser.")

        # Fallback intelligent regex/heuristic parser (ensures 100% uptime even offline/no-key)
        return AIParserService._fallback_rule_parser(text, account_names, category_names)

    @staticmethod
    def _fallback_rule_parser(
        text: str,
        account_names: List[str],
        category_names: List[str]
    ) -> AIParsedResult:
        """Deterministic rule-based parser for quick fallback."""
        cleaned = text.replace(",", ".").lower()

        # Check for transfer keyword
        if "перевод" in cleaned or "перевел" in cleaned or "перевела" in cleaned:
            amt_match = re.search(r"(\d+(?:\.\d+)?)", cleaned)
            amount = float(amt_match.group(1)) if amt_match else 0.0
            return AIParsedResult(
                transactions=[
                    AIParsedTransaction(
                        amount=amount,
                        type="transfer",
                        category_name="Переводы",
                        account_name=account_names[0] if account_names else "Основной",
                        to_account_name=account_names[1] if len(account_names) > 1 else None,
                        note="Перевод между счетами"
                    )
                ]
            )

        # Split multi-transactions by "и" or comma or "а также"
        clauses = re.split(r"\s+(?:и|\+|,|а\s+также)\s+", cleaned)
        results: List[AIParsedTransaction] = []

        for clause in clauses:
            clause = clause.strip()
            if not clause:
                continue

            # Extract amount
            amt_match = re.search(r"(\d+(?:\.\d+)?)", clause)
            if not amt_match:
                continue
            amount = float(amt_match.group(1))

            # Detect account
            matched_acc = None
            for acc in account_names:
                acc_clean = acc.lower().replace("карта", "").strip()
                if acc_clean and acc_clean in clause:
                    matched_acc = acc
                    break

            # Detect income
            is_income = any(w in clause for w in ["зарплата", "доход", "аванс", "кешбэк", "пришло", "пополнил", "перевели"])

            # Detect category
            matched_cat = "Еда"
            if any(w in clause for w in ["кофе", "обед", "ужин", "бургер", "кафе", "ресторан", "самокат", "вкусвилл"]):
                matched_cat = "Еда"
            elif any(w in clause for w in ["такси", "метро", "бензин", "заправка", "автобус", "каршеринг"]):
                matched_cat = "Транспорт"
            elif any(w in clause for w in ["аптека", "врач", "лекарств", "витамин", "клиника"]):
                matched_cat = "Здоровье"
            elif any(w in clause for w in ["кино", "игры", "подписка", "яндекс", "netflix", "spotify"]):
                matched_cat = "Развлечения" if "подписк" not in clause else "Подписки"
            elif is_income:
                matched_cat = "Зарплата"
            else:
                matched_cat = "Покупки"

            # Clean note
            note_words = [w for w in clause.split() if not w.isdigit() and w not in ["р", "руб", "рублей", "с", "на", "карты"]]
            note = " ".join(note_words).capitalize() if note_words else matched_cat

            results.append(
                AIParsedTransaction(
                    amount=amount,
                    type="income" if is_income else "expense",
                    category_name=matched_cat,
                    account_name=matched_acc or (account_names[0] if account_names else None),
                    note=note
                )
            )

        return AIParsedResult(transactions=results)
