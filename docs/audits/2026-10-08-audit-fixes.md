# Исправления аудита AI Money — 2026-10-08

Исходный аудит сохранён в 2026-10-08-full-audit.md. Исправления внесены локально на main / исходном HEAD7c1d37c; без push/deploy и изменения реальной финансовой базы. Ниже закрытие конкретных причин аудита, а не гарантия отсутствия любых ошибок.

| Пункты | Реализованное исправление | Проверка |
|---|---|---|
| A01 | Webhook только в explicit mode, обязательный HTTPS/secret, reject missing/wrong header, безопасная ошибка | test_webhook |
| A02 | Общий provider/consent gate, opt-in false, удалён Google fallback | test_ai_preview, test_ai_provider |
| A03 | Персональные fixtures и общая локальная книга удалены; токен в памяти; старые несинхронизированные данные доступны отдельным экспортом | client.test, пустой реальный API |
| A04 | Same-origin /api и loopback proxy; настоящий локальный вход | браузер375px, изолированный API8009 |
| A05/A06 | Ошибки не заменяются успехом; revision на PUT/DELETE; stable retry identity | client.test, forms.test; browser create/edit/delete |
| A07/A08 | Узкие DTO счетов, metadata edit без balance/currency; серверные категории/parent_id | HTTP tests, browser account create, code contract review |
| A09/A10/A11 | Серверные snapshots заменяют кэш; никаких fallback accounts/balances | useLedger.test, пустое состояние в браузере |
| A12 | Серверные месячные итоги/категории, выбранная валюта и UTC, страницы50; валюты не суммируются через выдуманный FX | backend analytics tests, browser RUB/USD, client pagination |
| A13 | Удаление перевода обновляет серверные остатки без второго локального списания | useLedger.test, HTTP tests, browser transfer/delete |
| A14/A15 | Фото/аудио/текст → editable review → explicit save, неизвестный получатель требует выбора | AiPreview tests, real text preview/cancel без изменения баланса |
| A16 | synchronize_session=False и refresh подтверждения в новой сессии | test_bot_drafts |
| A17 | created_at:null отклоняется до mutation; новые Transaction схемы NOT NULL | test_http |
| A18 | Черновик честно подписан; исправление отменяет старый draft, пакет подтверждается явно | test_bot_preview |
| A19 | API не запускает polling; standalone polling запрещён в webhook mode | lifespan regression |
| A20 | Docker frontend+backend blueprint, обязательная DATABASE_URL; production SQLite требует явного persistent-storage флага; compose volume согласован | startup regression, конфигурационное ревью; deployment не выполнен |
| A21 | Backend pytest и Vitest входят в обязательный quality | реальный общий прогон |
| A22 | Неоднозначные суммы/даты требуют уточнения, Decimal scaling, intent с ё | parser regressions |
| A23 | Bot preview получает настоящие currency/category | test_bot_preview |
| A24 | Sync errors видимы, старое success сообщение очищается при refresh; очистка названа очисткой legacy cache | offline browser, hooks tests, code review |
| A25 | Dialog/focus trap/inert/restore, русские имена кнопок, zoom; серверная категория не подменяется персональной taxonomy | Dialog tests, browser focus, categoryDisplay tests |
| A26 | Совместимые updates; Tailwind4 обоснован отсутствием compatible security fix в Tailwind3 цепочке | npm audit0; build;375/320/1280 browser |
| A27 | README/START_HERE/frontend/integrations/QUALITY и общая передача синхронизированы с actual/planned | проверка команд/путей |
| A28 | Реальный Groq audio HTTP adapter, без скрытого fallback | wire mock test; облачная приёмка отдельно |

## Дополнительные исправления независимого ревью

Дата формы входит в актуальное замыкание; доход выбирает доходную категорию. Начальный баланс проверяется до Number вместо parseFloat. Редактор показывает валюту счёта. Завершение записи после смены месяца/валюты обновляет текущий выбранный период. Каждый дефект покрыт regression. Retry неизменённого ручного черновика сохраняет ключ, изменение полей создаёт новый ключ.

## Выполненная приёмка

- quality: Ruff, toolkit15, structure, backend65, frontend20, production build — PASS.
- npm audit:0 reported vulnerabilities; pip-audit pinned Python lock:0 known vulnerabilities. Это состояние баз advisories на дату проверки, не доказательство отсутствия неизвестных уязвимостей.
- Ограниченный secret-pattern scan84 Git commits:20 повторных совпадений в документах, все классифицированы как синтетический placeholder. Энтропийный/универсальный secret scan не выполнялся; история финансовых fixtures сохранена.
- Независимый reviewer: backend63 PASS до последних двух тестов; затем maintained targeted7 и независимые reproductions5 PASS. Подтверждённые замечания исправлены.
- Реальный браузер + изолированная SQLite: login/empty/onboarding; расход10→edit15.25→delete с восстановлением остатка; новые RUB/USD счета; перевод10 и его удаление (0/1000→-10/1010→0/1000); text review/cancel; недоступный API с видимой ошибкой и безопасный повторный вход после перезапуска.
- Размеры320×640,375×812,1280×800; визуально проверен Tailwind4, modal background inert и focus. Интерактивные карточки recent доступны как button.
- Временные данные только синтетические в work/acceptance/fix-check.db.

## Границы

Физические Telegram iOS/Android, canonical Figma, production settings/deployment, PostgreSQL concurrency, реальные Groq/Gemini запросы, restore реальной базы и длительная нагрузка не проверены. Облачный adapter проверен mock-контрактом. UI CSV пока запланирован; API существует. Старый local cache не удалён автоматически, Git history с прежними fixtures не переписана. Старые браузеры до Safari16.4/Chrome111/Firefox128 требуют проверки совместимости Tailwind4. Native Antigravity/macOS integration отдельно не аттестованы.

Следующий рекомендуемый шаг: отдельная Telegram/device приёмка на синтетических данных, затем решение о миграции/публикации. Локальный PASS не является разрешением deployment.
