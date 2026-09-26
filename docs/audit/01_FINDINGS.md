# Реестр находок AI Money — 2026-09-26



Все находки открыты. Разделы независимы и могут описывать разные стороны одной причины. Приоритеты приведены в плане A0–A9. Путь и строка относятся к исходному ZIP, не к будущей версии. Runtime probes — синтетические, не инциденты production.



# Дополнение: безопасность, протоколы и эксплуатация
Дата: 2026-09-26. Статический анализ; runtime-проверки перечислены отдельно. Все находки открыты, исправлений нет.

| ID / приоритет | Доказательство в архиве | Условие и последствие | План и критерий закрытия |
|---|---|---|---|
| SEC-01 P0 | bot/app/api/deps.py:14–30 | user_id и X-User-Id без проверки задают личность; отсутствие/ошибка подписи даёт общий demo ID. DEBUG=False не устраняет этот путь. | Только проверенный Telegram principal; неизвестный вход 401. Два синтетических пользователя: нельзя читать/писать чужие записи; query/header не меняют личность. |
| SEC-02 P1 | bot/app/core/security.py:16–28,31–51; config.py:23 | DEBUG по умолчанию разрешает demo/test; подписанный initData не проверяется по времени; без user ID используется auth_date как ID. | Явный изолированный demo; auth_date TTL и допустимый clock skew; требовать user.id, отклонять повторяющиеся ключи. Тесты старой/будущей/неполной подписи. TTL — решение приложения, не число из Telegram. |
| RES-01 P0 | bot/app/core/database.py:60–83 | При ошибке основной БД переключение на ./finance.db, подавление всех ошибок ALTER TABLE. Приложение может писать новую историю и объявлять здоровье. | Fail closed для финансовых записей; миграции Alembic вне startup; /readyz 503 при недоступной БД. Тест обрыва БД не должен создавать заменяющую БД. |
| RES-02 P1 | bot/app/main.py:26–37,58–76,102–109 | Polling запускается в каждом API процессе; health постоянен; shutdown отменяет task без ожидания; внешний supervisor повторяет через 5s. | Один polling worker на токен; API отдельно при масштабировании; ожидать отмену; readiness БД и heartbeat worker. Проверить restart, два процесса, SIGTERM, зависший worker. Внутренний backoff aiogram существует, утверждать его отсутствие нельзя. |
| RES-03 P1 | render.yaml:4–7; main.py:39–50; database.py:68 | Free Render + локальная SQLite fallback; localhost self-ping не доказывает внешнюю доступность и не восстанавливает уже уснувший процесс. | Постоянное хранилище и подходящий always-on runtime при переходе к круглосуточному боту; восстановление backup измерить. На Mac сон/отключение означает отсутствие доступности до запуска. |
| AI-01 P1 | bot/app/services/ai_parser.py:108–150; receipt.py:48–54; ocr_service.py:61–79 | Синхронные декодирование, Google speech и subprocess OCR вызываются из async обработчиков. Swift timeout 15s блокирует loop; Tesseract вызов без явного timeout. | to_thread/process с ограничением очереди, времени и размера; под нагрузкой OCR обычный текст продолжает обслуживаться. |
| AI-02 P1 | bot/app/api/routes/ai.py:38,51–53; voice.py:17–24; receipt.py:27–32 | Полное чтение загрузки без прикладного лимита; нет видимого quota/rate limit. Ошибки отправляются клиенту как str(e). | Лимиты bytes/duration/pixels, MIME+decoder проверка, rate limit на пользователя, безопасные коды ошибок. 400 не превращать общим except в 500. Проверить 413/415/429 и память. |
| AI-03 P1 | ai_parser.py:135–145,167–193; common.py:213–419; receipt.py:88–98 | Сбой Groq переключает на Google speech/rules; расшифровка попадает в INFO log; результат AI/OCR сразу записывается. Это риск неверной записи и передачи финансового текста внешнему поставщику. | Парсер возвращает черновик с provenance и предупреждениями; человек подтверждает сумму/счёт; обезличенные логи и понятный выбор провайдера. Никакой уверенности модели вместо проверки. |
| AI-04 P2 | config.py:14; ai_parser.py:167–193; render.yaml:11 | GEMINI_API_KEY объявлен, но parse_financial_text использует только Groq, затем правила. README обещает Gemini без реализации. | Выбрать один рабочий провайдер или реализовать адаптер Gemini с контрактными тестами; при GEMINI-only явно видно provider, без молчаливой подмены. |
| OPS-01 P1 | ocr_service.py:74–95; bot/requirements.txt; Dockerfile:5–8 | Linux OCR требует PIL, pytesseract, бинарник Tesseract и rus+eng; они не установлены декларациями проекта. | Явные optional OCR зависимости и readiness функции; проверка на macOS Vision отдельно от Linux OCR. Локальный Mac результат не доказывает Docker-путь. |
| OPS-02 P1 | Dockerfile:13; отсутствуют .dockerignore и .gitignore в ZIP | После заполнения bot/.env Docker COPY bot/ включает секрет в образ. В данном архиве обнаружены только .env.example; наличие утечки реального ключа не утверждается. | Добавить ignore, secrets injection на runtime; тест содержимого образа и контекста. |
| OPS-03 P2 | Dockerfile:10–21; main.py:115–117 | Docker не собирает и не копирует frontend/dist; при ожидании all-in-one UI не будет. | Документировать отдельный static hosting либо multi-stage build и реальный smoke /. |
| RES-04 P1 | bot/app/bot/state.py:5–14,25–61 | Состояние редактирования/уточнения хранится в process dict, timestamp не обеспечивает TTL. | Persist pending drafts в БД, TTL очистка; reboot не теряет подтверждённую операцию, устаревший callback объяснимо отклоняется. |
| RES-05 P1 | text.py:13–17; voice.py:31; receipt.py:88–98; common.py:336–419 | message/update ID не передаётся в финансовую команду, batch сохраняется по одному элементу; сбой ответа после commit создаёт двусмысленность. | UNIQUE(bot_id,update_id,operation_index), операция и ключ в одной транзакции, повторная доставка безопасна; durable acknowledgement/outbox при необходимости. Тест crash после commit до ответа. |

P0 — закрыть до реальных многопользовательских данных; P1 — до доверенного использования; P2 — улучшение сопровождения. Риск deployment условен: реальный прод не проверялся.

## Дополнительная проверка интеграции

| ID / приоритет | Доказательство | Последствие и проверка закрытия |
|---|---|---|
| SEC-03 P1 | callbacks.py:30–44; finance_svc.py:593–646 | После callback menu URL получает #sync с base64 остатков, счетов, user_id и последних 50 операций. Это кодировка, не шифрование. common.py:116–130 использует другой, чистый URL, поэтому пути расходятся. Fragment обычно не уходит HTTP-серверу, но доступен клиентскому JS, истории/копированию ссылки и самой Telegram-кнопке. Не утверждается доказанная утечка внешнему сайту. План: только opaque ID операции в deep link, данные через авторизованный API; decoded URL не содержит финансовых записей. |
| OPS-04 P0 для локальных проб | frontend/.env.example:2 vs frontend/src/api/client.ts:3 | Шаблон предлагает VITE_API_BASE, код читает VITE_API_URL и иначе использует конкретный удалённый Render endpoint. Следование шаблону не направляет фронтенд к локальной базе. Remote endpoint не вызывался. План: единое имя env, обязательная проверка base URL, без неявного внешнего default; Network в Mac smoke показывает только согласованный тестовый backend. |
| DOC-01 P2 | DEVELOPER_GUIDE.md:24–55; README.md:9–12; file inventory | Документация перечисляет отсутствующие backup/ocr routes и useAudioRecorder, обещает Gemini и синхронизацию сверх реализации. План: feature matrix implemented/planned/verified, runnable setup, подтверждение команды запуска из чистой копии. |

## Ошибка числового парсера — отдельная карточка

**AI-05 / P1 (блокер достоверного автоматического ввода).** `bot/app/services/ai_parser.py:66–76,196–202,243–247,293–321`: decimal point воспринимается как нумерация списка, пробелы тысяч не разбираются, дата со slash превращается в число, float сумма превращается в длинную дробь и затем в большую целую часть. Runtime: «250,50»→50; «1 500»→1; «26/09 500»→26009; «0.1+0.2»→30000000000000004. Последнее — результат parser, не доказанная запись такой суммы в Numeric(14,2). Вторая операция без суммы молча пропускается. План: единая проверяемая грамматика Money с единицами/датами, строгие ограничения, multi-operation clarification, обязательный просмотр черновика. Приёмка: эти фразы, копейки, разделители тысяч, десятичные запятые/точки, даты и несколько операций; неоднозначность возвращает уточнение, ничего не пишет.


# Финансовое ядро: результаты независимой проверки

Дата: 2026-09-26. Область: `bot/app/services/finance_svc.py`, ORM-модели, Pydantic-схемы, routes accounts/transactions/analytics, SQL migration, существующие тесты. Исходники не изменялись. Пути далее относительно `work/source`.

## Метод и ограничения

Воспроизводимый скрипт: `finance_probe.py`; фактический обезличенный stdout повторного прогона: `finance-probe.log`. Запуск из `work`: `python -B audit/finance_probe.py --source source`. При передаче отдельно: `python -B finance_probe.py --source /absolute/path/to/extracted/archive-root`, где root содержит `bot/app/services/finance_svc.py`. Сам архив/его исходники в доказательный скрипт не включены; пользователь предоставляет извлечённый оригинал. Зависимости берутся из локального окружения, автоматически не устанавливаются. Версии записаны первой строкой лога. Exit 0 означает завершение диагностического прогона, а не прохождение продуктом проверок: строки фиксируют наблюдаемые дефекты.

Выполнен статический анализ и два изолированных Python-прогона с настоящими моделями, схемами и FinanceService из архива. Среда: установленный Python 3.11, SQLAlchemy/aiosqlite, SQLite `:memory:`; модуль `app.core.database` подменён **только внутри процесса** минимальным `Base=declarative_base()`, чтобы не загружать настройки, секреты и реальные подключения. Запрещена запись bytecode. Ни БД пользователя, ни сеть не использовались. PostgreSQL, HTTP authentication и производственная конкурентная нагрузка здесь не запускались. Полный штатный pytest этим агентом не запускался; файлы тестов прочитаны.

Критичность: P0 — блокирует допуск к чужим финансовым данным; P1 — нарушает денежный учёт / доступность; P2 — функциональная надёжность. Это технический аудит, не заключение о сертификации ISO.

## Подтверждённые дефекты

### FIN-01 · P0 · PUT может менять баланс чужого пользователя

**Доказательства:** `bot/app/services/finance_svc.py:381-415`, `:461-480`; `bot/app/api/routes/transactions.py:99-109`. Владелец исходной транзакции проверяется, но произвольный новый `account_id`/`to_account_id` выбирается только по ID. UPSERT также принимает чужой счёт. В таблице нет составного FK `(user_id, account_id)` (`bot/app/models/models.py:53-58`).

**Воспроизведено:** счёт пользователя 2 с синтетическим балансом 100; вызов update_transaction пользователем 1 с новым ID и account_id пользователя 2. Баланс стал 90, новая транзакция принадлежит пользователю 1. Это проверка сервиса, не сетевой exploit.

**Исправление в плане:** одна функция require_owned_account/category, строгая проверка обоих счетов до любых изменений; аналогичные проверки для POST category_id (`finance_svc.py:339`) и защиты на уровне БД. Исключить неявный UPSERT или выделить отдельный контракт создания.

**Приёмка:** два пользователя; POST/PUT с чужим источником, получателем, категорией дают 403/404; ни одна строка и баланс не изменены. Проверить также существующую транзакцию и несуществующий ID.

### FIN-02 · P1 · Потеря финансового изменения при пересечении запросов

**Доказательства:** `finance_svc.py:310-331`, `:358-377`, `:442-515`. Баланс читается и перезаписывается целым значением, без блокировки строки, версии или атомарного SQL increment.

**Воспроизведено:** два AsyncSession заранее прочитали 100; один создал расход 10, другой 20. В журнале обе записи, сумма 30, баланс 80 вместо 70. Использовано управляемое чередование двух сессий, не нагрузочный тест PostgreSQL.

**Исправление:** операция над журналом и балансами в единой DB-транзакции; атомарные delta updates либо упорядоченные блокировки счетов, оптимистическая версия для редактирования/удаления. При смене счёта блокировать все затронутые счета в стабильном порядке. Один владелец commit на границе use case.

**Приёмка:** 100 конкурентных расходов, доходов, переводов; баланс равен opening_balance + сумме проводок; одновременные update/delete одного ID не создают двойной возврат; повтор после deadlock безопасен.

### FIN-03 · P1 · Инициализация ломает второго пользователя

**Доказательства:** `finance_svc.py:115-136`, `:179-234`; `models.py:53`. Наличие транзакции проверяется только у данного пользователя, но seed использует одинаковые глобальные primary key из констант. GET accounts/categories запускает seed (`:237-238`, `:290-291`).

**Воспроизведено:** ensure_user_seeded(3) успешен, ensure_user_seeded(4) даёт IntegrityError. Счета второго пользователя успевают сохраниться отдельным commit (`:130`), затем вставка транзакций падает.

**Исправление:** production onboarding создаёт пустые пользовательские счета/категории явно и один раз; демонстрационные данные — отдельная среда/fixture, уникальные ID. Удалить запись данных из GET.

**Приёмка:** десять новых пользователей и параллельный первый вход; независимые пустые журналы, нет ID collision, повтор GET ничего не пишет.

### FIN-04 · P1 · Удалённые демооперации воскресают, баланс расходится с журналом

**Доказательства:** `finance_svc.py:204-234`, `:351-377`, `:237-238`. DELETE возвращает сумму на счёт, последующий GET восстанавливает отсутствующий seed ID без повторного списания. Константные начальные балансы и история также не образуют явно описанной системы opening balances.

**Воспроизведено:** delete одной seed-транзакции, затем get_accounts — удалённая запись снова присутствует.

**Исправление:** убрать восстановление seed при чтении; определить opening balance и однозначное уравнение сверки, не считать существующие константы автоматически достоверной бухгалтерией. Демоисторию отделить от пользовательской.

**Приёмка:** create/update/delete с последующим refresh/restart; удалённая операция не появляется вновь, сверка баланса с журналом неизменна.

### FIN-05 · P1 · Отрицательный расход зачисляет деньги; нет строгого типа Money

**Доказательства:** `schemas/finance.py:55-73` — float без gt=0/finite/precision/upper limit; `finance_svc.py:13-21`, `:317-340`; DB amount без CHECK >0 (`models.py:59`, `001_initial_schema.sql:41`).

**Воспроизведено:** expense -5 принят и повышает баланс 100→105. to_dec(2.675)→2.67, to_dec(Decimal('2.675'))→2.675, to_dec('bad')→0.00. Следовательно нормализация зависит от входного типа и скрывает некорректный ввод.

**Исправление:** Decimal из десятичной строки или целые minor units; явно выбрать политику округления и поддерживаемую точность валют. Reject zero/negative/NaN/Infinity/overflow; не заменять ошибку нулём. Создание и изменение используют один канонический amount и для журнала, и для баланса.

**Приёмка:** -1, 0, NaN/Infinity, слишком большая сумма, 2.675, 0.005, 0.1+0.2; одинаковый контракт SQLite/PostgreSQL; create→delete точно восстанавливает баланс. Результат 2.675 сам по себе не объявляется неверным без выбранной бизнес-политики; неверна неоднородность текущего пути.

### FIN-06 · P1 · PUT перевод без получателя уничтожает сумму в учёте

**Доказательства:** `finance_svc.py:395-415`, `:474-496`. POST требует получателя (`:323-329`), PUT/upsert — нет; неизвестный получатель молча превращается в None.

**Воспроизведено:** новый transfer с account_id и amount=10, без to_account_id: источник 105→95, получателя нет.

**Исправление:** единые инварианты POST/PUT: два существующих собственных разных счёта, сумма >0; проверка до отмены старой операции; некорректный update целиком отклоняется.

**Приёмка:** missing/unknown/foreign/same destination, смена expense→transfer, очистка получателя у transfer; во всех недопустимых случаях баланс и журнал неизменны.

### FIN-07 · P1 · Межвалютный перевод выполняется 1:1

**Доказательства:** `finance_svc.py:325-331`, `:408-415`, `:493-496`; Transaction хранит только одну amount, не содержит валюты операции, полученной суммы, курса и комиссии (`models.py:50-70`).

**Воспроизведено:** перевод 10 из RUB в USD списал 10 RUB и зачислил 10 USD.

**Исправление:** для первой безопасной версии запретить переводы разных валют. Позднее добавить source_amount/currency, destination_amount/currency, fee и зафиксированный курс с датой/источником; не пересчитывать историю текущим курсом.

**Приёмка:** RUB→RUB сохраняет сумму; RUB→USD отклонён до реализации FX; после реализации пример 900 RUB→10 USD отражён двумя точными суммами плюс отдельная комиссия.

### FIN-08 · P1 · «Месячная» аналитика считает последние 20 операций за всё время

**Доказательства:** `finance_svc.py:521-589`, `api/routes/analytics.py:10-16`. month_offset принят, но не использован; limit(20) питает одновременно список последних операций и агрегаты; подпись всегда «Сентябрь 2026».

**Воспроизведено:** вызовы month_offset=0 и -12 дали полностью одинаковую сводку; recent_count=20.

**Исправление:** отдельные SQL SUM/GROUP BY для выбранного периода и отдельный paginated recent list; границы периода по выбранному часовому поясу пользователя, хранение UTC; динамическая подпись.

**Приёмка:** 21+ операций за месяц и операции за границей месяца; ожидаемая полная сумма, переключение месяца меняет результат; ночь на стыке месяцев и часовые пояса.

### FIN-09 · P1 · Валюты и долги не имеют достаточного учётного контракта

**Доказательства:** `finance_svc.py:525-528` — USD*90/EUR*98, любая другая валюта *1; `:548-553` — расходы разных валют складываются без пересчёта. AccountUpdate разрешает сменить валюту существующего счёта (`schemas/finance.py:25`; `finance_svc.py:267-271`), а Transaction не сохраняет свою валюту. Долги исключаются по строке имени группы.

**Статически подтверждено:** 100 RUB расхода и 100 USD расхода дают period_expense=200; смена валюты счёта переинтерпретирует все его операции. Фиксированные курсы не маркированы как оценка. Исключение долгов может быть корректно только для показателя «активы», но не «чистый капитал» — требование уточнить в плане.

**Исправление:** отдельные суммы по валютам либо явная оценка в base_currency с dated FX snapshot; currency immutable после появления операций; account_kind вместо сравнения русского названия группы; отделить активы, обязательства и net worth.

**Приёмка:** мультивалютные данные не суммируются как одна валюта, неподдерживаемая валюта отклоняется; переименование группы не меняет финансовый смысл; изменение валюты непустого счёта запрещено.

### FIN-10 · P1 · Удаление непустого счёта падает

**Доказательства:** `finance_svc.py:278-286`; `models.py:33`, `:56`. SQL FK объявлен CASCADE, но ORM relationship не имеет соответствующей cascade/passive_deletes политики; ORM пытается обнулить обязательный account_id.

**Воспроизведено:** после двух операций delete_account даёт IntegrityError на SQLite. Это не доказательство успешного CASCADE в PostgreSQL.

**Исправление:** для финансового журнала предпочтительнее архивировать счёт; определиться с сохранением истории и остатком. Если допускается физическое удаление, ORM и DB cascade должны совпадать, а проводки переводов оставаться объяснимыми.

**Приёмка:** архивирование счёта с расходами и переводами сохраняет журнал/аналитику; счёт больше не доступен для новых операций; исходный API не возвращает 500.

## Дополнительные подтверждённые риски / требующие интеграционной проверки

### FIN-11 · P1 · Идемпотентность не переносится на существующую SQL-схему

`models.py:68-69` содержит UNIQUE(user_id,client_id). Но исходная SQL migration не содержит client_id вообще (`supabase/migrations/001_initial_schema.sql:35-45`), а startup migration добавляет только колонку (`core/database.py:74-83`), не UNIQUE. create_all не является системой миграций существующих таблиц. Поэтому **для БД, созданной данным SQL**, проверка select-before-insert (`finance_svc.py:299-307`) не защищает от конкурентных дублей. Для новой ORM-БД UNIQUE есть, но конфликт не преобразуется в возврат предыдущего результата; API возвращает 500 (`transactions.py:94-96`). Существующий client_id с другим payload молча возвращает старую запись.

План: версионные миграции; UNIQUE + request fingerprint; транзакционное разрешение конфликта/возврат существующего результата; повтор ключа с иными параметрами — 409. Acceptance: два одновременных одинаковых запроса дают одну запись/одно списание и одинаковый ответ; другой payload — 409. Проверить на PostgreSQL и SQLite. **Состояние реальной БД неизвестно**, этот риск применим к указанному пути миграции.

### FIN-12 · P2 · Разные типы идентификаторов в ORM и SQL

`models.py:19,38,53,55-58` использует String(36); `001_initial_schema.sql:7,23,36,38-40` — uuid. Штатный тест UPSERT использует `unknown-custom-uuid-999` (`tests/test_finance.py:119-130`), который SQLite принимает, а PostgreSQL UUID не представляет. План: один канонический тип UUID и ранняя Pydantic-валидация; отдельные integration tests по обоим поддерживаемым хранилищам. Конкретный driver-level результат на PostgreSQL не воспроизводился.

### FIN-13 · P2 · GET запускает полные выборки и многократную инициализацию

`finance_svc.py:133-145` загружает все операции при каждом seed; accounts/categories каждый раз зовут seed. Роут list_transactions сначала ограничивает запрос limit, а затем всё равно загружает все операции через get_accounts/get_categories (`transactions.py:25-36`). Параметры limit/offset не ограничены (`transactions.py:20-21`). Это не измеренная деградация, но подтверждённый алгоритмический O(N) путь на обычное чтение.

План: убрать seed из чтений; `EXISTS` только в onboarding; bounded pagination; индексы под `(user_id, created_at, id)`. Acceptance: query count и объём чтения не растут линейно с полной историей при list limit=50; отрицательные/слишком большие limit отклоняются.

### FIN-14 · P2 · Прямая правка баланса не оставляет основания сверки

`schemas/finance.py:24`, `finance_svc.py:267-273` позволяют произвольно заменить balance без отдельной correction/opening entry. Это может быть осознанной функцией ручной сверки, но сейчас невозможно восстановить баланс только из журнала. План: выделить «Корректировка остатка» с причиной, временем и прежним значением; opening balance явно хранить. Acceptance: после корректировки журнал объясняет разницу, повтор запроса не создаёт вторую коррекцию.

## Покрытие имеющимися тестами

В `bot/tests/test_finance.py` 7 тестов: seed/get, expense CRUD, demo security, 2 parser tests, unknown-ID upsert, transfer update. Есть полезные последовательные happy path проверки. Нет двух пользователей, конкурентных сессий, отрицательных/нечисловых сумм, отсутствующего получателя в PUT, FX, периода с >20 операциями, удаления seed и повторного GET, удаления непустого счёта, существующей мигрированной PostgreSQL schema, idempotency collision. Тест seed поощряет предзаполненный положительный баланс (`:31-34`); тест UPSERT закрепляет неявное создание (`:127-136`). Зелёный исходный набор не доказывает достоверность финансового учёта.

## Очерёдность рефакторинга

1. Зафиксировать безопасные synthetic fixtures и регрессии FIN-01…08; любые реальные записи из констант не переносить в общий test dataset.
2. Убрать seed из GET, изолировать demo/onboarding. Описать корректный старт существующих данных без автоматической перезаписи.
3. Money/Currency и единые правила операций; POST/PUT/delete через один use case. Никаких неявных подстановок счёта и нулевой суммы при ошибке.
4. Ввести единые tenant checks, DB constraints и версионные миграции; сначала backup/restore drill на синтетической копии.
5. Единая атомарная граница записи, concurrency control, idempotency и reconciliation. Можно сохранить материальный balance, если он полностью выводим и сверяем; полный double-entry ledger — отдельное решение по масштабу, не обязательная перепись первого этапа.
6. Разделить latest list/analytics, даты/валюты/долги; архивирование счетов и журнал корректировок.
7. Разнести крупный FinanceService на onboarding, accounts, transaction use cases, analytics/repositories; не менять поведение одновременно во всех модулях. После каждого среза регрессии, статическая проверка, повторные money-invariant tests.

## Короткий журнал фактических результатов

Первый изолированный прогон, exit 0: FOREIGN_ACCOUNT_PUT balance=90 caller=1 owner=2; NEGATIVE_EXPENSE balance=105 amount=-5; TRANSFER_NO_DEST balance=95 destination=None; FX_TRANSFER source RUB 95→85, USD 0→10; DELETED_SEED_RESTORED=True; SECOND_SEEDED_USER=IntegrityError; MONTH_OFFSET_IGNORED same=True recent_count=20.

Второй прогон, exit 0: STALE_READ_LOST_UPDATE expected=70 actual=80 tx_total=30; DELETE_ACCOUNT_WITH_TRANSACTIONS=IntegrityError. Реальная БД пользователя не читалась. Seed-пробы использовали константы из исходников; их исходные суммы и заметки в отчёт не переносились.


# Frontend audit evidence — 2026-09-26

Scope: static read-only analysis of frontend and matching backend contracts, plus isolated execution of original pure TypeScript modules with mocked fetch/localStorage. No production requests, browser UAT, installation or source edits. Probe: `node work/audit/frontend-probe.mjs`; recorded output `frontend-probe-results.json`. This is an engineering audit, not an ISO certification.

Priorities: P0 = immediate risk of incorrect financial records; P1 = fix before real use; P2 = next hardening slice. Paths below relative to work/source. Confirmed static findings indicate definite code behavior, not observed production incidents.

## Confirmed findings

### FE-01 / P0 — Ошибка сети выдается за сохранённую операцию
- Evidence: frontend/src/api/client.ts:1005–1027 returns fabricated success object on ANY HTTP error/timeout; 1055–1062 returns true on DELETE network exception. frontend/src/App.tsx:177–246 adjusts local ledger before response; 396 and 468 ignore PUT/DELETE result; 248–258 accepts fallback ID as server acknowledgement.
- Executed probe: POST 401 returns a transaction; offline DELETE returns true.
- Impact: Алина видит расход/удаление как успешное, сервер ничего не сохранил. Обновление страницы не исправляет это, потому что локальные переопределения сохраняются.
- Fix plan: typed result/error contract; explicit pending/confirmed/failed state; preserve original idempotency key for retry; acknowledge only actual server commit; reconcile ambiguous timeouts by operation key. Decide offline support explicitly; for novice MVP disable offline mutation with a clear draft instead of building an unreliable queue.
- Acceptance: 401, 422, 500, connection loss before send/after commit, request timeout; no false success; retry creates one record.

### FE-02 / P0 — Удаление перевода ещё раз списывает деньги с отправителя
- Evidence: frontend/src/App.tsx:419–427 treats transfer source as income when reversing: `expense ? balance + amount : balance - amount`; destination also subtracts.
- Repro (static arithmetic): A=1000, B=0; transfer 100 yields A=900/B=100; delete yields A=800/B=0, should A=1000/B=0. Total loss in display = 200. App:432–437 persists wrong balances; client:908–920 masks server correction.
- Fix: one tested reversal rule for all transaction types, preferably server-authoritative balances.
- Acceptance: create→delete identity for income/expense/transfer; source/destination and total conservation.

### FE-03 / P0 — Фото любого чека создаёт выдуманный расход 850
- Evidence: frontend/src/App.tsx:532–543 reads existence of chosen file then directly calls handleAddTransaction with amount=850 and first category. No OCR use or preview.
- Repro: select any image in receipt scan flow; handler creates fixed expense independent of contents.
- Fix: temporarily disable this UI action or implement upload→parse→review→explicit confirmation; never invent accounting data.
- Acceptance: receipt 123.45 results in reviewed 123.45; blank/unreadable/non-receipt results in no ledger write.

### FE-04 / P1 — Локальный баланс навсегда сильнее серверного
- Evidence: frontend/src/App.tsx:199–204,329–339,432–437 record balance snapshots for each mutation; frontend/src/api/client.ts:908–920 unconditionally overlays those snapshots on fresh account responses. Timestamps are stored but not compared. No call to deleteUserAccountMod in App.
- Executed probe: server balance 800, old local mod 900 → merged 900.
- Impact: операции из Telegram/другого устройства перестают менять показанный баланс после первого редактирования в Mini App.
- Fix: server is ledger source; clear acknowledged optimistic changes; revisions/conflict handling, not blanket snapshot overwrite.
- Acceptance: Mini App expense then bot expense → both devices converge; stale response cannot revert latest revision.

### FE-05 / P1 — Серверные правки и удаления транзакций игнорируются
- Evidence: frontend/src/api/client.ts:773–788 starts from local list and only adds unknown server IDs; existing ID server contents never replace local, absent IDs never remove local. 700–726 applies permanent local edits/tombstones.
- Executed probe: same transaction server amount 20, local 10 → result 10.
- Fix: authoritative paginated transaction query with revision/deletion markers, pending overlay only; do not infer deletion from a truncated recent list.
- Acceptance: edit/delete via bot visible on refresh; old local edit does not undo newer server revision.

### FE-06 / P1 — Новый счёт сохраняется под двумя разными ID
- Evidence: frontend/src/App.tsx:492–511 generates acc-Date.now and ignores createAccountAPI response; bot/app/schemas/finance.py:17–18 AccountCreate has no id; bot/app/services/finance_svc.py:252–257 creates model; bot/app/models/models.py:19 generates UUID. client:908–924 does not append created local accounts or respect deleted account tombstones.
- Impact: immediately adding an expense to local account ID cannot find corresponding server account; polling may replace/disappear local account. Failed deleted account can reappear.
- Fix: replace local temporary ID with returned server account everywhere after create, block transaction until account confirmed or use one supported client-generated ID; account mutation errors must surface.
- Acceptance: create account→immediate transaction→refresh; one account, one stable ID, correct balance; deletion failure preserves account.

### FE-07 / P1 — Категории интерфейса не соответствуют серверным
- Evidence: frontend/src/api/client.ts:978–988 never calls category endpoint; frontend/src/App.tsx:564–606 only saves localStorage; client initial IDs cat-1 etc; bot/app/models/models.py:38 UUID category IDs and :58 FK transaction category.
- Impact: local category IDs are sent as server foreign keys; custom category edits exist only on one device; category type `both` and subcategories also absent from backend schema (schemas/finance.py:37–52). Actual DB rejection depends on enforced FK and DB type; contract mismatch is confirmed.
- Fix: canonical category API/model + migration of legacy local IDs by explicit map; preserve subcategory semantics; generate frontend DTO types from OpenAPI.
- Acceptance: create/edit category on Mac; create transaction; bot and another device see same category, valid FK; no accidental name-based reassignment.

### FE-08 / P1 — Пустые реальные данные заменяются демонстрационными
- Evidence: client.ts:936 checks nonempty server accounts, :953 fallback INITIAL_ACCOUNTS; :775–782 injects INITIAL_RECENT_TRANSACTIONS when cache empty, even if server returns empty. App initial data :65–109.
- Executed probe: successful GET accounts `[]` → 14 preloaded accounts.
- Impact: новый пользователь получает чужие/демонстрационные остатки и историю, вместо пустого состояния. Authenticity of embedded historical personal-looking records is unknown; do not redistribute those records in report.
- Fix: demo behind explicit isolated mode; distinguish empty success from failure; empty onboarding state.
- Acceptance: clean profile + empty backend → zero accounts/transactions, no prefilled financial data.

### FE-09 / P1 — История и месячные суммы ограничены последними 20 операциями
- Evidence: bot/app/services/finance_svc.py:532 `.limit(20)`; frontend client fetchDashboard :743 and :838–845 recomputes values from recent list; DashboardScreen.tsx:84–98,177–186 computes month totals from same list. No GET transactions pagination call in client.
- Impact: на новом устройстве старый месяц и месяц с >20 операциями неполные; локальный накопленный кэш делает результаты различными по устройствам. Demo rows can additionally pollute totals.
- Fix: separate full-period aggregate API from paginated history; server filter with timezone and period boundaries.
- Acceptance: 21+ transactions across months on fresh device; displayed totals match complete ledger, including old month.

### FE-10 / P1 — Валюты складываются как одинаковые единицы
- Evidence: DashboardScreen.tsx:63–65 sums raw balances and :318 renders ruble total; AccountsScreen.tsx:41 uses fixed USD*90/EUR*98; client.ts:767 same hardcoded rates. App:183–188 transfers same number across currencies; Transaction type has no currency/rate fields.
- Repro (static arithmetic): 100 RUB +100 USD → dashboard 200 ₽ vs accounts 9100 ₽. Transfer 100 RUB→USD credits 100 USD.
- Fix: first release restrict accounts/transfers to RUB OR define currency-specific minor units and explicit dated FX rates, source/destination amounts and fee. Do not silently choose rate.
- Acceptance: totals same on all screens; cross-currency transfer forbidden or documented converted amounts; historical value stable after current rate changes.

### FE-11 / P1 — Голосовой fallback ошибается в сумме и сразу проводит запись
- Evidence: voiceParser.ts:60–73 shortcuts and digits; :80–95 ignores denomination boundaries; :113–129 prioritises transfer words. VoiceOverlay.tsx:81–118 falls back even when server returned clarification without transactions; App:817–825 commits without review.
- Executed original-parser probes: «5 тысяч рублей»→5; «сто рублей пятьдесят копеек»→150 (expected100.50); «две с половиной сотни»→2500 (expected250); «перевод получила 500 рублей»→transfer instead of incoming classification.
- Fix: always draft+confirmation for AI/voice; honor clarification; unit-aware parser or narrow supported grammar; unsupported text must stay ambiguous, not guessed.
- Acceptance: corpus with decimals, thousands, kopecks, multiple amounts, incoming external transfers, ambiguity; no write before confirmation.

### FE-12 / P1 — Перевод сам себе проходит после попытки автокоррекции
- Evidence: AddTransactionScreen.tsx:260–269 calls setToAccount(diff) but does not return; :285–287 submits captured OLD toAccount. App:184–188 subtracts source then returns without credit if same ID.
- Repro: choose identical from/to with another account available, submit; request retains identical IDs despite state update.
- Fix: reject identical IDs; require user to select target; backend validation too.
- Acceptance: same-account transfer does not submit and does not change balances.

### FE-13 / P2 — 35-я категория стирает пользовательский набор
- Evidence: client.ts:984 accepts only length<35; :987 overwrites with INITIAL_CATEGORIES; App.tsx:73–76 same.
- Executed probe: stored 35 categories → fetchCategories returns16 and overwrites storage.
- Fix: validate schema not arbitrary count, explicit supported max with non-destructive error; migrate cache version.
- Acceptance: 0,34,35,100 categories survive reload or explicit limit blocks creation without loss.

### FE-14 / P1 — Кэш не разделён по пользователям; входящие sync данные неподписаны
- Evidence: client.ts:512–548 accepts base64 JSON from URL or initDataUnsafe.start_param, :567–589 persists data; keys :513–514,:653,:861,:966 have no user identity. No schema/owner validation in ingest.
- Impact: same-origin browser profile changing user can retain another person's balances/history; crafted link can poison locally shown transactions. This proves local cache issue, NOT arbitrary server ledger write or remote account compromise.
- Fix: authenticated server refresh; don't transport finances in links; per-user cache namespaces and clear-on-identity-change; validate schema and revisions.
- Acceptance: user A→B in same profile reveals no A data; unsigned sync payload does not change ledger view.

### FE-15 / P2 — Редактор молча сохраняет неверную/старую сумму
- Evidence: EditTransactionModal.tsx:139–152 parseFloat on each '+' part accepts partial numeric input; :918–919 falls back to original on zero/invalid input but accepts negative parseFloat; :945 sends undefined for cleared note, so backend exclude_unset won't clear it.
- Repro (static): input '0' keeps old amount, '-5' passes -5, '10abc+20' evaluates30; empty note omitted by JSON.stringify, old server note remains.
- Fix: full-string strict money parser with positive amount and supported precision; explicit error instead of old amount; send null/empty according to clearing contract.
- Acceptance: malformed/negative/zero blocked; clearing note survives reload; rounding cases tested.

### FE-16 / P2 — Перекрывающиеся опросы могут применить устаревший ответ
- Evidence: App.tsx:111–130 Promise.all read/commit; :145–155 focus/pageshow/visibility plus interval3000; client.ts:5 timeout4500. No sequence number/cancellation/inflight guard.
- Confirmed exposure, timing impact needs delayed-response test. At slow server round trip two refreshes overlap; older response may complete after newer.
- Fix: deduplicate active query; cancel or discard old response; exponential backoff+jitter and bounded refresh; refresh after acknowledged mutation.
- Acceptance: deliberately resolve request2 before request1; current state retains request2; offline polling does not flood service.

### FE-17 / P2 — Коллизии временных ID при пакетном голосовом вводе
- Evidence: App.tsx:212 ID is Date.now; :769 loop invokes handleAddTransaction synchronously multiple times; client.ts:677 record keyed by ID.
- Conditional reproducible race: two entries within one millisecond share ID and overwrite modification map; response ID replacement maps all matching rows. Actual occurrence not timed in browser.
- Fix: UUID per transaction created before local insertion, retained as client_id through acknowledgement.
- Acceptance: fixed clock/multiple voice transactions produce distinct IDs, one ack only replaces its row.

## Refactoring slices (plan only)
1. Freeze reference dataset and money invariants; backup/export/restore before later migration. Tests for create/edit/delete reversal, failure semantics, period totals.
2. Extract pure money/date/transaction functions and typed DTOs. Separate demo fixture data from production client; remove invented fallback success.
3. Choose online-first MVP; central query/mutation state with explicit operation status and user-scoped cache. Server ledger authoritative; no permanent balance snapshot overrides.
4. Account/category CRUD contracts and stable identity migration. Do not migrate by fuzzy account names.
5. Paginated history + aggregate endpoints; RUB-only guard or explicit FX model.
6. AI/receipt/voice draft review; deterministic validation. Clarifications retain structured draft.
7. Split App orchestration, EditTransactionModal and client into coherent small modules; tests precede extraction, don't change behavior and architecture in one giant diff.
8. Add focused Vitest tests + React integration tests + Playwright flows against disposable local backend; Mac Safari/Telegram WebView acceptance separately.

## Verification boundary
Executed Node original-module mock probes, not frontend build/browser/end-to-end. No external website was accessed by this subagent. Parent owns research and infra verification. Arithmetic walkthroughs above are static derivations from exact code, not claimed UI tests. Source project remained unchanged.

