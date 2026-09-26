# Исследование и реестр внешних оснований
## Резюме

Исследование поддерживает план сначала исправить права, денежную целостность и поведение при сбоях, сохранив основной стек. Настройка модели и обновление библиотек сами по себе эти дефекты не исправляют.

Дата чтения всех источников: 2026-09-26. Метод: web search → открытие официальной страницы → применимость к коду. Сниппеты и форумы не использованы как доказательство. Дата публикации неизвестна, если не указана в названии стандарта. Все записи ниже searched/read; границы прямо указаны.

## Источники

Реестр ниже содержит прочитанные первоисточники и применимость каждого вывода.

| ID / вопрос | Тип, вердикт | Прочитанный источник / локатор | Вывод и границы |
|---|---|---|---|
| R01 Что означает ISO? | fact supported | [ISO/IEC 27001:2022](https://www.iso.org/standard/27001), CIA triad и certification | Управление конфиденциальностью, целостностью и доступностью через риск-процесс. Аудит кода не сертификация организации. Полный платный текст не изучен; нумерация Annex A не присваивается наугад. |
| R02 Проверка Telegram | fact supported | [Mini Apps](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app), HMAC и auth_date | Проверять initData сервером, можно дополнительно проверять возраст. Конкретный TTL устанавливает приложение. SEC-01/02 подтверждены отдельно кодом и probe. |
| R03 Повтор HTTP | fact supported | [RFC 9110 §9.2.1–9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2) | PUT/DELETE идемпотентны по эффекту. Не повторять неидемпотентный запрос вслепую; POST с устойчивым ключом — решение приложения. Различный ответ второго DELETE сам по себе не нарушение. |
| R04 JSON числа | fact supported | [RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) | NaN/Infinity не входят в JSON. Стандарт не требует Decimal, но ограничения range/precision должны учитываться. Финансовая точность — прикладной контракт. |
| R05 Даты | fact supported | [RFC 3339 §5.6](https://www.rfc-editor.org/rfc/rfc3339.html#section-5.6) | Формат timestamp со смещением; UTC и отдельная зона отчётности — наш проектный выбор. Ошибку месячного отчёта доказывает код, не RFC. |
| R06 Ошибки API | recommendation | [RFC 9457 §3](https://www.rfc-editor.org/rfc/rfc9457.html#section-3) | Использовать problem+json для единого контракта ошибок. Отсутствие этой формы не является само по себе нарушением HTTP. |
| R07 Сон/диск Render | fact supported | [Render Free](https://render.com/docs/free), Spinning down и Local files lost | Free runtime засыпает после 15 min без inbound, локальные изменения теряются при restart/redeploy/spindown. Это конфликт с SQLite fallback; конкретный deployment не проверялся. |
| R08 Telegram при выключенном Mac | fact supported | [Bot API Getting updates](https://core.telegram.org/bots/api#getting-updates) | Updates не хранятся дольше 24h; нельзя обещать бесконечное восстановление очереди после выключения Mac. Не измерена задержка именно Алины. |
| R09 SQLite foreign keys | fact supported | [SQLite foreignkeys](https://sqlite.org/foreignkeys.html), Enabling Foreign Key Support | Проверять PRAGMA foreign_keys на каждом соединении. Ограничения модели без включённого enforcement не доказательство целостности. |
| R10 Гонки PostgreSQL | fact supported / recommendation | [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html), Read Committed / Serializable | Транзакция не исправляет сама stale read-modify-write. Выбрать atomic UPDATE и/или блокировку плюс retries; воспроизведение сейчас SQLite, PostgreSQL test обязателен. |
| R11 Денежная арифметика | recommendation | [Python decimal](https://docs.python.org/3/library/decimal.html) | Decimal даёт десятичную арифметику; выбирать явное округление. Decimal(float) не восстанавливает исходную точность: принимать строку или minor units. |
| R12 Async работа | recommendation | [asyncio.to_thread](https://docs.python.org/3/library/asyncio-task.html#asyncio.to_thread), [SQLAlchemy asyncio](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) | Блокирующий I/O вынести из event loop; отдельная AsyncSession на task. Это не замена DB locking и не обещание CPU ускорения. |
| R13 Объектные права | fact supported | [OWASP API1:2023](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/) | Проверять права на каждый объект; валидный user ID не даёт прав на account ID другого владельца. |
| R14 Свежая Gemini для IDE | fact supported | [Antigravity Models](https://antigravity.google/docs/models), Reasoning Model | Страница перечисляет Gemini 3.8 Flash, 3.7/3.6 Flash и 3.1 Pro; показывает 3.8 Flash Medium и 3.1 Pro High. Рекомендация: 3.8 Flash для небольших задач, 3.1 Pro High для сложного независимого ревью, если доступны. Это не измеренное сравнение качества; доступ в аккаунте Алины не проверен. |
| R15 Gemini в приложении | fact supported | [Gemini API Models](https://ai.google.dev/gemini-api/docs/models), Stable / Endpoints | gemini-3.8-flash указан stable, 3.1 Pro — preview. IDE-модель и API-модель бота — разные настройки. Новый провайдер потребует реализации, ключа и тестов. |
| R16 Структурированный AI | fact supported / recommendation | [Gemini Structured output](https://ai.google.dev/gemini-api/docs/structured-output), введение и Python | JSON Schema/Pydantic поддерживаются. Формат ответа не подтверждает правильность суммы, принадлежность счёта или смысл фразы; независимая валидация обязательна. |
| R17 Правила Antigravity | fact supported | [Rules](https://antigravity.google/docs/rules?tab=ide), Directory-scoped / activation | GEMINI.md/AGENTS.md в проекте, .agents/rules/*.md с trigger. Не менять global файл Алины. Native activation проверяется в новой сессии; наличие файла не равно активации. |
| R18 Конфиденциальность Gemini API | fact supported, scope-limited | [Gemini API Terms](https://ai.google.dev/gemini-api/terms), Unpaid Services и региональные исключения | Условия бесплатного API допускают использование данных для улучшения сервисов и предупреждают о sensitive data; для некоторых регионов действуют исключения. Проверить регион/тариф перед реальными чеками. Эти условия не переносить автоматически на IDE. |

## Ключевые находки

- «Включить DEBUG=False и авторизация станет безопасной» — contradicted: get_current_user_id обходит проверку вне DEBUG (runtime).
- «Все тесты зелёные — финансовые расчёты верны» — contradicted: 7 existing PASS совместимы с ошибками parser/ownership/lost-update.
- «Gemini уже встроена в парсер» — contradicted: объявлена переменная, реализация Groq→rules, вызова Gemini нет.
- «Structured output исключает денежные ошибки» — insufficient: источник обещает структуру, корректность финансового смысла требует тестов.
- «Современный стек требует переписать React/FastAPI» — insufficient: конкретные сбои вызваны контрактами и логикой, сборка проходит.
- «Демонстрационные суммы в архиве — реальные финансы Алины» — insufficient: происхождение неизвестно, в итоговые материалы сырые записи не копируются.
- «ISO compliance подтверждено» — insufficient: нет организационного scope, оценки риска/SoA/свидетельств эксплуатации и сертификационного аудита.

## Альтернативы и контраргументы

SQLite достаточно для одного локального экземпляра при проверенных транзакциях/backup; PostgreSQL оправдан при серверном многопользовательском использовании. Замена СУБД сама не убирает гонку read-modify-write. Offline-first полезен, но требует журнала ожидающих операций и конфликтов: сейчас рекомендуем online-write + локальные черновики как первый безопасный этап. AI ускоряет ввод, но его отключение не должно ломать ручной учёт. Lock-файл важнее обновления всех major-версий ради новизны. Decimal и integer minor units оба допустимы при едином контракте; двойная реализация формул в UI и backend недопустима.

## Журнал поиска

1. web.search: `site.antigravity.google docs rules workflows Gemini models`; открыты Models, IDE rules redirect, конечная Rules; исключены Reddit.
2. web.search: `site.ai.google.dev gemini models latest stable`; открыты Models, Structured outputs, Terms; changelog найден, но не использован для утверждений о релизной дате.
3. web.search: `site.iso.org ISO IEC 27001 2022 information security management`; открыта ISO landing, сторонние копии полного стандарта не использованы.
4. Прямое открытие первоисточников RFC 9110/8259/3339/9457, Telegram Mini Apps/Bot API, Render Free, Python Decimal/asyncio, SQLAlchemy asyncio, SQLite FK, PostgreSQL isolation, OWASP API1.
5. Целевой find: auth_date, ephemeral, no longer than 24 hours, .agents/rules, semantic. Поиск semantic на structured output не дал совпадений: вывод ограничен заявленной схемой, не расширен до доказательства смысловой точности.
6. Проверка противоречий: DEBUG false через ASGI probe; зелёные tests vs отдельные probes; README Gemini vs rg исходников; поверхность harness vs успешный npm build.

Остановка исследования: ключевые решения по auth, деньгам, отказам, среде и handoff имеют первичное основание или явный пробел. Не исследованы правовой статус оператора по странам, фактический тариф/регион Алины, сравнительный benchmark моделей. Это не обязательные доказательства для локального плана исправлений; они нужны до публичного запуска.


## Открытые вопросы

Неизвестны target версии и аккаунт Antigravity Алины, её банк/формат экспорта, runtime/PostgreSQL deployment и фактические условия AI обработки. Дополнительные запросы пользователя расширили scope: комплект Antigravity описан в07, банковский import workflow — в08, сравнение приложений и банковские источники — в09. Эти документы фиксируют будущие действия, не их выполнение.
