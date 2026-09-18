# 💸 AI Финансы (Telegram Bot + Telegram Mini App)

Персональная система учёта личных финансов, состоящая из **Telegram-бота** (для быстрого голосового и текстового ввода с AI-парсингом) и **Telegram Mini App** (TMA, с точным воспроизведением UI/UX мобильного приложения «Учёт расходов, бюджет AI» из App Store).

---

## 🌟 Возможности системы

1. **Telegram-бот (Быстрый ввод на ходу):**
   - 🎙️ **Приём голосовых сообщений**: Мгновенная расшифровка аудио (.ogg) через **Groq Whisper Large v3** (~300мс).
   - 💬 **Свободный текст**: «Кофе 250 с карты Альфа», «Такси 450 и аптека 1200» (поддержка мульти-транзакций в одном сообщении).
   - 🧠 **AI-парсер (100% Free Tier)**: Извлечение суммы, категории, счёта списания/зачисления и заметки через **Groq Llama 3.3 70B** или Gemini Flash.
   - ⚡ **Интерактивные инлайн-карточки**: Кнопки быстрой отмены/удаления и перехода в Mini App.
   - 📱 **Кнопка меню**: «📊 Бюджет» для открытия Mini App прямо из Telegram.

2. **Telegram Mini App (Пиксель-в-пиксель к App Store референсу):**
   - 📱 **Главный экран (Дашборд)**:
     - Общий баланс со значком кошелька (переход в Счета).
     - Селектор месяца (`< Сентябрь 2026 >`).
     - Сальдо периода, плашки доходов (`↓ 0 ₽`) и расходов (`↑ 0 ₽`).
     - Сетка круглых категорий с эмодзи (`🍔 Еда`, `🚗 Транспорт`, `🛍️ Покупки`...).
     - Лента недавних трат с датами («7 мая», `Самокат -894 ₽`, `Подписки -645 ₽`).
     - Нижний плавающий бар: Сканер чеков, Главная синяя кнопка микрофона, Кнопка `+`.
   - 💳 **Экран «Счета»**:
     - Общий баланс `671 841,11 ₽`, сгруппированные разделы *«Личное»* и *«Общее»*.
     - Карточки счетов (Наличные, Карта Альфа, Т-Банк, Озон Банк, Накопительный счет, Брокерский счет).
     - Плавающая кнопка перевода `⇄`.
   - ⌨️ **Экран добавления операции**:
     - Переключатель `[- +]`, ввод суммы с анимированным синим курсором.
     - Горизонтальная карусель категорий.
     - Нативная **iOS-клавиатура с русскими буквами (кириллицей)** под цифрами (1, 2 А Б В Г, 3 Д Е Ж З...).
     - Тактильный отклик (Haptic Feedback) на каждый клик.
   - 🎙️ **Оверлей голосового ввода**:
     - Экранированное затемнение, звуковая индикация «Говорите...», кнопки отмены, подтверждения и настроек.

---

## 🛠 Бесплатный стек (100% Free Tier)

| Компонент | Технология | Провайдер / Хостинг |
|---|---|---|
| **Frontend (TMA)** | React 18 + Vite + Tailwind CSS + Lucide Icons | Vercel / Cloudflare Pages (Free) |
| **Backend** | Python 3.12 + FastAPI + Aiogram 3 | Render Free Tier / VPS / Local |
| **База данных** | PostgreSQL (Supabase / Neon) или SQLite | Supabase (500 MB Free) |
| **Speech-to-Text** | Whisper Large v3 | Groq Cloud API (Free) |
| **AI Парсер** | Llama 3.3 70B Versatile / Gemini Flash | Groq Cloud / Google AI Studio (Free) |

---

## 🚀 Быстрый старт

### 1. Настройка окружения
Склонируйте репозиторий и создайте `.env` в папке `/bot`:

```bash
cd bot
cp .env.example .env
```

Заполните переменные:
- `BOT_TOKEN` — токен вашего Telegram-бота от [@BotFather](https://t.me/BotFather).
- `GROQ_API_KEY` — бесплатный API-ключ от [Groq Console](https://console.groq.com/keys).
- `WEBAPP_URL` — ссылка на развернутый фронтенд (например, `https://your-mini-app.vercel.app` или `http://localhost:5173`).
- `DATABASE_URL` — строка подключения к Supabase PostgreSQL или локальный SQLite (`sqlite+aiosqlite:///./finance.db`).

### 2. Запуск бэкенда и бота
```bash
cd bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*API документация доступна по адресу:* `http://localhost:8000/docs`

### 3. Запуск фронтенда (Mini App)
```bash
cd frontend
npm install
npm run dev
```
*Фронтенд запустится на:* `http://localhost:5173`

---

## 🧪 Запуск тестов
```bash
cd bot
source .venv/bin/activate
pytest -v
```

---

## 📁 Структура проекта
```
ai-money/
├── bot/                         # FastAPI бэкенд + Aiogram 3 бот
│   ├── app/
│   │   ├── api/routes/          # REST эндпоинты (accounts, categories, transactions, ai)
│   │   ├── bot/handlers/        # Обработчики Telegram (start, voice, text, callbacks)
│   │   ├── core/                # Конфигурация, security (HMAC), DB engine
│   │   ├── models/              # SQLAlchemy модели
│   │   ├── schemas/             # Pydantic v2 схемы
│   │   └── services/            # Бизнес-логика финансов и AI-парсер
│   ├── tests/                   # Автотесты (pytest)
│   └── requirements.txt
├── frontend/                    # React 18 Telegram Mini App
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/       # Главный экран с балансом и категориями
│   │   │   ├── accounts/        # Экран счетов и групп
│   │   │   ├── transaction/     # Экран ввода с iOS калькулятором
│   │   │   ├── modals/          # Шторка выбора счета
│   │   │   ├── voice/           # Голосовой оверлей
│   │   │   └── keypad/          # Кастомная iOS-клавиатура с кириллицей
│   │   ├── hooks/               # useTelegram (Haptics, initData)
│   │   └── api/                 # API клиент с offline-fallback
│   └── package.json
└── supabase/migrations/         # SQL-миграции PostgreSQL
```
