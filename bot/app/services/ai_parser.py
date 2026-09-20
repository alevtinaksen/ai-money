import io
import re
import json
import logging
from typing import List, Optional
from app.core.config import settings
from app.schemas.finance import AIParsedResult, AIParsedTransaction, PendingClarification

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = """Ты — интеллектуальный финансовый ассистент личного бюджета.
Твоя задача — извлечь транзакции из текста пользователя на русском языке и вернуть структурированный JSON.

Доступные счета пользователя:
{accounts_list}

Доступные категории расходов:
{categories_list}

Правила:
1. Выдели ВСЕ упомянутые финансовые операции:
   - Если пользователь перечислил несколько операций (например: «Кофе 200 и аптека 1500», либо перечислением «Первое такси 400, второе кофе 250, третье продукты 1500», «Во-первых... во-вторых...», «1)... 2)...», «а также... потом...»):
     ОБЯЗАТЕЛЬНО верни КАЖДУЮ операцию отдельным объектом в массиве `transactions`! Не склеивай их!
2. Для каждой операции определи:
   - amount: число (float), сумма операции. ВАЖНО: если сумма записана через математическое выражение со знаком плюс (например: «1104+1104+137» или «500+250»), ОБЯЗАТЕЛЬНО сложи эти числа и запиши в amount единую итоговую сумму сложения (например: 2345.0)!
   - type: 'expense' (расход), 'income' (доход), или 'transfer' (перевод между счетами).
     * ВХОДЯЩИЕ ПЕРЕВОДЫ («перевод от подруги/друга/мамы», «скинули 500», «перевели мне 500», «пришли деньги») — это СТРОГО type: 'income' (доход), category_name: 'Переводы (получено)' или 'Зарплата'.
     * НАКОПЛЕНИЯ С ПОКУПКИ («накопления с покупки 37», «округление», «копилка») — это СТРОГО type: 'transfer' со счета карты на счет «Инвесткопилка (Альфа)», category_name: 'Накопления', note: 'Накопления с покупки'.
     * ПЕРЕВОД МЕЖДУ СВОИМИ СЧЕТАМИ («перевела 5000 с альфы на тинькофф») — type: 'transfer', category_name: 'Переводы'.
   - category_name: выбери наиболее подходящую категорию. 
     * Заведения общепита («Теремок», «Шоколадница», «Вкусно и точка», «Бургер Кинг», «Додо», «Кафе», «Кофейня», «Dream kids») — это ВСЕГДА «Еда».
     * Доставка продуктов («Самокат», «Вкусвилл», «Перекресток») — «Еда» (подкатегория «Самокат»).
   - account_name: если упомянут счёт или сервис («Озон» -> «Озон Банк», «Альфа» -> «Карта Альфа (Основной)», «Т-Банк» / «Тинькофф» -> «Т-Банк Black», «наличные» -> «Наличные (Психотерапевт)», «с Владом» -> «Влад и Алина - Едоки (Т-Банк)», «копилка» -> «Инвесткопилка (Альфа)»), сопоставь с доступными счетами.
   - to_account_name: если это перевод (transfer), укажи счет зачисления (например «Инвесткопилка (Альфа)»).
   - note: краткое описание покупки или действия («Теремок», «Кофе», «Перевод от подруги», «Накопления с покупки», «Самокат», «Озон»).
3. Если пользователь не назвал сумму операции (например: «Запиши маникюр», «Такси», «Обед с коллегами») или сумма неразборчива:
   - transactions оставь пустым: []
   - заполни поле "pending":
     {{
       "question": "Уточните стоимость операции «...»",
       "suggested_options": [1500.0, 2000.0, 2100.0, 2500.0],
       "category_name": "...",
       "account_name": "...",
       "note": "..."
     }}

Верни ответ СТРОГО в формате JSON:
{{
  "transactions": [
    {{
      "amount": 250.0,
      "type": "expense",
      "category_name": "Еда",
      "account_name": "Карта Альфа (Основной)",
      "to_account_name": null,
      "note": "Кофе"
    }}
  ],
  "clarification": null,
  "pending": null
}}
"""

class AIParserService:
    @staticmethod
    def evaluate_plus_expressions(text: str) -> str:
        """
        Evaluates mathematical addition expressions like '1104+1104+137' -> '2345'
        or '500 + 250' -> '750'
        """
        def repl(m):
            expr = m.group(0)
            parts = [float(p.strip()) for p in expr.split("+") if p.strip()]
            total = sum(parts)
            return str(int(total) if total.is_integer() else total)
        return re.sub(r"(\b\d+(?:\.\d+)?(?:\s*\+\s*\d+(?:\.\d+)?)+\b)", repl, text)

    @staticmethod
    def match_account_name(text: str, account_names: List[str]) -> Optional[str]:
        cleaned = text.lower()
        if "озон" in cleaned or "ozon" in cleaned:
            for a in account_names:
                if "озон" in a.lower() or "ozon" in a.lower():
                    return a
        if any(w in cleaned for w in ["влад", "едок", "совместн", "общ", "на еду", "общая", "общей"]):
            for a in account_names:
                if any(w in a.lower() for w in ["влад", "едок", "совместн", "общ"]):
                    return a
        if "т-банк" in cleaned or "тбанк" in cleaned or "тиньк" in cleaned or "tinkoff" in cleaned:
            for a in account_names:
                if "black" in a.lower() or ("т-банк" in a.lower() and "едок" not in a.lower()):
                    return a
        if "налич" in cleaned or "налом" in cleaned or "нал " in cleaned:
            for a in account_names:
                if "налич" in a.lower():
                    return a
        if "альф" in cleaned or "alfa" in cleaned:
            for a in account_names:
                if "альф" in a.lower() and "накоп" not in a.lower() and "инвест" not in a.lower() and "кредит" not in a.lower() and "влад" not in a.lower():
                    return a
        for a in account_names:
            a_clean = a.lower().replace("карта", "").replace("банк", "").replace("счёт", "").strip()
            if a_clean and a_clean in cleaned:
                return a
        return None

    @staticmethod
    async def transcribe_audio(audio_bytes: bytes, filename: str = "voice.ogg") -> str:
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

        try:
            import speech_recognition as sr
            from pydub import AudioSegment
            try:
                import imageio_ffmpeg
                AudioSegment.converter = imageio_ffmpeg.get_ffmpeg_exe()
            except Exception as ffmpeg_err:
                logger.warning(f"Could not configure imageio_ffmpeg: {ffmpeg_err}")

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
        if not text.strip():
            return AIParsedResult(transactions=[])

        # 1. First evaluate math additions (e.g. 1104+1104+137 -> 2345)
        eval_text = AIParserService.evaluate_plus_expressions(text)

        # 2. Normalize speech numbers (e.g. 2/100 -> 2100, две сто -> 2100)
        norm_text = AIParserService.normalize_speech_numbers(eval_text)

        if settings.GROQ_API_KEY:
            try:
                from groq import AsyncGroq
                client = AsyncGroq(api_key=settings.GROQ_API_KEY)

                system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
                    accounts_list=", ".join(account_names) if account_names else "Карта Альфа (Основной), Озон Банк, Т-Банк Black, Наличные",
                    categories_list=", ".join(category_names) if category_names else "Еда, Транспорт, Покупки, Развлечения, Здоровье"
                )

                chat_completion = await client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": norm_text}
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

        return AIParserService._fallback_rule_parser(norm_text, account_names, category_names)

    @staticmethod
    def normalize_speech_numbers(text: str) -> str:
        def repl_slash(m):
            k = int(m.group(1))
            h = int(m.group(2))
            return str(k * 1000 + h)
        
        res = re.sub(r'(\b\d{1,2})\s*/\s*(\d{2,3}\b)', repl_slash, text)

        patterns = [
            (r'\bполторы\s+тысяч[иея]?\b', '1500'),
            (r'\bполторы\b', '1500'),
            (r'\bдве\s+с\s+половиной\s+тысяч[иея]?\b', '2500'),
            (r'\bдве\s+с\s+половиной\b', '2500'),
            (r'\bтри\s+с\s+половиной\b', '3500'),
            (r'\bчетыре\s+с\s+половиной\b', '4500'),
            (r'\bпять\s+с\s+половиной\b', '5500'),
            (r'\bдве\s+сто\b', '2100'),
            (r'\bдве\s+двести\b', '2200'),
            (r'\bдве\s+триста\b', '2300'),
            (r'\bдве\s+четыреста\b', '2400'),
            (r'\bдве\s+пятьсот\b', '2500'),
            (r'\bтри\s+сто\b', '3100'),
            (r'\bтри\s+двести\b', '3200'),
            (r'\bтри\s+пятьсот\b', '3500'),
            (r'\bчетыре\s+пятьсот\b', '4500'),
            (r'\bодна\s+тысяча\b', '1000'),
            (r'\bдве\s+тысячи\b', '2000'),
            (r'\bтри\s+тысячи\b', '3000'),
            (r'\bчетыре\s+тысячи\b', '4000'),
            (r'\bпять\s+тысяч\b', '5000'),
            (r'\bдесять\s+тысяч\b', '10000'),
            (r'\bпятьсот\b', '500'),
            (r'\bшестьсот\b', '600'),
            (r'\bсемьсот\b', '700'),
            (r'\bвосемьсот\b', '800'),
            (r'\bдевятьсот\b', '900'),
        ]
        for p, r in patterns:
            res = re.sub(p, r, res, flags=re.IGNORECASE)
        return res

    @staticmethod
    def _fallback_rule_parser(
        text: str,
        account_names: List[str],
        category_names: List[str]
    ) -> AIParsedResult:
        cleaned = text.replace(",", ".").lower()
        cleaned = re.sub(r"^(?:запиши|записать|добавь|пожалуйста|слушай)\s+", "", cleaned)

        enum_pattern = r"(?:(?:\b(?:первое|во-первых|второе|во-вторых|третье|в-третьих|четвертое|в-четвертых|пятое|в-пятых|шестое|в-шестых|седьмое|восьмое|девятое|десятое|потом|затем|дальше|после\s+этого)\b)|(?:\b\d+[\.\)]\s*)|\n+|;|\s+(?:и|а\s+также|а\s+еще)\s+)"
        raw_clauses = [p.strip() for p in re.split(enum_pattern, cleaned) if p and p.strip()]

        if not raw_clauses:
            raw_clauses = [cleaned]

        stopwords = {
            "р", "руб", "рублей", "с", "со", "на", "в", "во", "карты", "карта", "карте",
            "запиши", "записать", "добавь", "пожалуйста", "еще", "ещё", "списал", "списали",
            "первое", "второе", "третье", "четвертое", "пятое", "шестое", "седьмое", "восьмое", "девятое", "десятое",
            "во-первых", "во-вторых", "в-третьих", "в-четвертых", "в-пятых",
            "это", "такое", "такое-то", "тоже", "потом", "затем", "дальше", "после", "этого", "пункт", "номер"
        }
        bank_words = {
            "альфа", "альфы", "альфе", "т-банк", "т-банка", "т-банке", "тбанк", "тинькофф",
            "тинькова", "тинькоф", "тиньков", "озон", "ozon", "сбер", "сбера", "наличные",
            "наличных", "налом"
        }

        # Resolve global fallback account
        global_account = AIParserService.match_account_name(cleaned, account_names) or (account_names[0] if account_names else "Основной")
        
        results: List[AIParsedTransaction] = []
        current_acc = None

        for clause in raw_clauses:
            # 1. Account resolution
            explicit_acc = AIParserService.match_account_name(clause, account_names)
            if explicit_acc:
                current_acc = explicit_acc
            acc = current_acc or global_account

            # 2. Check for incoming transfers from friend/other person
            is_incoming = any(
                w in clause for w in [
                    "перевод от", "скинули", "перевели мне", "пришли деньги",
                    "перевод от подруги", "перевод от друга", "вернули долг"
                ]
            )
            # 3. Check for savings / roundups
            is_savings = "накоплен" in clause or "округлен" in clause or "в копилк" in clause
            # 4. Check for transfer between own accounts
            is_transfer = ("перевод" in clause or "перевел" in clause or "перевела" in clause) and not is_incoming
            # 5. Check for general income
            is_income = any(w in clause for w in ["зарплата", "доход", "аванс", "кешбэк", "пришло", "пополнил"]) or is_incoming

            # Extract amount
            amt_match = re.search(r"(\d+(?:\.\d+)?)", clause)
            if not amt_match:
                # If only 1 clause was provided, ask for clarification
                if len(raw_clauses) == 1:
                    matched_cat = "Покупки"
                    if any(w in clause for w in ["теремок", "кофе", "обед", "ужин", "бургер", "кафе", "ресторан", "самокат", "вкусвилл", "еда", "шоколадниц", "додо", "макдоналдс", "ростикс", "кфс", "kfc", "dream kids", "окей", "о'кей", "пятерочк", "перекресток", "магнит", "лента", "ашан", "дикси", "спар", "spar", "супермаркет", "продукты", "наланч"]):
                        matched_cat = "Еда"
                    elif any(w in clause for w in ["маникюр", "педикюр", "брови", "волосы", "стрижка", "косметика", "спорт"]):
                        matched_cat = "Личное"
                    elif any(w in clause for w in ["такси", "метро", "бензин", "заправка", "автобус", "каршеринг"]):
                        matched_cat = "Транспорт"
                    elif any(w in clause for w in ["аптека", "врач", "лекарств", "витамин"]):
                        matched_cat = "Здоровье"

                    note_words = [w for w in clause.split() if not w.replace(".", "").isdigit() and w not in stopwords and w not in bank_words]
                    note = " ".join(note_words).capitalize() if note_words else matched_cat
                    return AIParsedResult(
                        transactions=[],
                        pending=PendingClarification(
                            question=f"❓ Какая стоимость операции **«{note}»**?",
                            suggested_options=[500.0, 1000.0, 1500.0, 2000.0, 2500.0, 3000.0],
                            category_name=matched_cat,
                            account_name=acc,
                            note=note
                        )
                    )
                continue

            amount = float(amt_match.group(1))
            to_acc = None

            if is_incoming:
                tx_type = "income"
                cat_name = "Переводы (получено)"
                note = "Перевод от подруги" if "подруг" in clause else ("Перевод от друга" if "друг" in clause else "Входящий перевод")
            elif is_savings:
                tx_type = "transfer"
                cat_name = "Накопления"
                to_acc = next((a for a in account_names if "инвест" in a.lower() or "копилк" in a.lower() or "накоп" in a.lower()), None)
                if not to_acc and len(account_names) > 1:
                    to_acc = account_names[1]
                note = "Накопления с покупки"
            elif is_transfer:
                tx_type = "transfer"
                cat_name = "Переводы"
                to_acc = next((a for a in account_names if a != acc), None)
                note = "Перевод между счетами"
            elif is_income:
                tx_type = "income"
                cat_name = "Зарплата"
                note = "Доход"
            else:
                tx_type = "expense"
                cat_name = "Покупки"
                suggested_amounts = [500.0, 1000.0, 1500.0, 2000.0, 2500.0, 3000.0]

                if any(w in clause for w in ["теремок", "кофе", "обед", "ужин", "бургер", "кафе", "ресторан", "самокат", "вкусвилл", "еда", "шоколадниц", "додо", "макдоналдс", "ростикс", "кфс", "kfc", "dream kids", "окей", "о'кей", "пятерочк", "перекресток", "магнит", "лента", "ашан", "дикси", "спар", "spar", "супермаркет", "продукты", "наланч", "на ланч"]):
                    cat_name = "Еда"
                    suggested_amounts = [250.0, 350.0, 500.0, 800.0, 1200.0]
                elif any(w in clause for w in ["маникюр", "педикюр", "брови", "волосы", "стрижка", "косметика", "спорт", "фитнес", "зал", "тренировк", "ногти", "ресниц", "внешний вид", "уход", "привычки", "вейп"]):
                    cat_name = "Личное"
                    suggested_amounts = [1500.0, 2000.0, 2100.0, 2500.0, 3000.0]
                elif any(w in clause for w in ["такси", "яндекс go", "uber", "каршеринг", "делимобиль", "ситидрайв", "метро", "автобус", "троллейбус", "трамвай", "подорожник", "поезд"]):
                    cat_name = "Транспорт"
                    suggested_amounts = [300.0, 500.0, 750.0, 1000.0, 1500.0]
                elif any(w in clause for w in ["бензин", "лукойл", "газпром", "роснефть", "азс", "заправка", "татнефть", "то авто", "парковка"]):
                    cat_name = "Машина"
                    suggested_amounts = [1000.0, 2000.0, 2500.0, 3000.0]
                elif any(w in clause for w in ["аптека", "врач", "лекарств", "витамин", "клиника", "психолог", "терапевт", "стоматолог", "зуб", "анализ"]):
                    cat_name = "Здоровье"
                    suggested_amounts = [1000.0, 2000.0, 3000.0, 5000.0, 10000.0]
                elif any(w in clause for w in ["кино", "игры", "вечеринк", "концерт", "театр"]):
                    cat_name = "Развлечения"
                    suggested_amounts = [500.0, 1000.0, 1500.0, 2000.0]
                elif any(w in clause for w in ["подписк", "яндекс плюс", "netflix", "spotify"]):
                    cat_name = "Подписки"
                    suggested_amounts = [299.0, 499.0, 799.0]
                elif any(w in clause for w in ["корм для кота", "кот", "кота", "коту", "зоомагазин"]):
                    cat_name = "Кот"
                    suggested_amounts = [500.0, 1000.0, 1500.0]
                elif any(w in clause for w in ["аренда", "жкх", "ремонт", "квартира", "интернет"]):
                    cat_name = "Жилье"

                note_words = [w for w in clause.split() if not w.replace(".", "").isdigit() and w not in stopwords and w not in bank_words]
                note = " ".join(note_words).capitalize() if note_words else cat_name

                if amount <= 10.0 and cat_name in ["Личное", "Здоровье", "Одежда"] and "рубл" not in clause and len(raw_clauses) == 1:
                    return AIParsedResult(
                        transactions=[],
                        pending=PendingClarification(
                            question=f"❓ Какая стоимость операции **«{note}»**? (Распознано: {amount:.0f} ₽)",
                            suggested_options=suggested_amounts,
                            category_name=cat_name,
                            account_name=acc,
                            note=note
                        )
                    )

            results.append(
                AIParsedTransaction(
                    amount=amount,
                    type=tx_type,
                    category_name=cat_name,
                    account_name=acc,
                    to_account_name=to_acc,
                    note=note
                )
            )

        return AIParsedResult(transactions=results)
