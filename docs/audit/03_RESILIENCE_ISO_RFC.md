# Устойчивость протоколов и ISO-oriented gap assessment

Это инженерная оценка по доступному коду и локальным сценариям. **Не сертификат ISO 27001, не аудит организации и не измерение production SLA.** Полный лицензионный текст стандарта не получен; ниже тематическое сопоставление без неподтверждённых номеров контролей. Основание ISO: [официальное описание стандарта](https://www.iso.org/standard/27001).

## Границы доверия

```text
Telegram / Mini App (недоверенный ввод и device cache)
              |
        API auth + object ownership
              |
     единый финансовый use case
              |
         SQL database + backups
              |
       read-only analytics / audit log

AI / speech / OCR -> только draft -> подтверждение -> use case
```

В текущем коде граница auth обходится (SEC-01), UI и backend ведут разные копии финансовой правды (FE-01/04/05), AI/OCR способны непосредственно инициировать запись. Инвентарь активов: журналы операций, остатки, категории, Telegram ID, голос/фото, токены, database files/backups, localStorage, логи. Origin исходных констант неизвестен; считать потенциально приватными, не использовать для публичных примеров.

## Матрица протоколов

| Поверхность | Реализация / состояние | Оценка и необходимая проверка |
|---|---|---|
| Telegram Mini App HMAC | security.py вычисляет HMAC и compare_digest; deps.py обходит результат | Формула сама по себе не защищает путь. Auth probes FAIL; старый auth_date принят. Исправление SEC-01/02; [Telegram contract](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app). |
| HTTP GET | get_accounts/get_categories вызывают seed с commit | Нарушается ожидаемая безопасность чтения из [RFC9110 §9.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.1): GET может восстанавливать удалённую операцию и ломать нового пользователя. |
| POST/PUT/DELETE | client_id есть; ORM UNIQUE есть, старый SQL path расходится; frontend скрывает ошибки | Проверять идемпотентный эффект, не равенство status codes. Не объявлять любой UPSERT нарушением RFC: проблема здесь — права, недопроверенный перевод и неявный бизнес-контракт. [RFC9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2). |
| HTTP errors / retries | общий except раскрывает exception; frontend success fallback | Единого error contract нет. Предложение RFC9457 problem+json; отсутствие этого формата само не нарушение. 401/403 не retry;429 учитывать Retry-After; network/5xx только с safe/idempotent semantics и лимитом. |
| JSON numbers | schemas float, frontend Number, DB Numeric | FIN-05 и parser probe показывают неустойчивую арифметику. JSON запрещает NaN/Infinity, но сам не гарантирует финансовую точность. [RFC8259 §6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6). |
| Timestamp / отчётный период | SQL timestamps, mixed ISO strings, fixed month, recent20 | Ввести RFC3339 с timezone на границе, UTC storage и выбранную зону отчётов. Синтаксис timestamp и корректность месячного SQL — разные проверки. [RFC3339](https://www.rfc-editor.org/rfc/rfc3339.html). |
| Telegram polling | aiogram background task в API lifespan | Один token — один polling owner; перезапуски/несколько workers не проверены live. Устойчивый update dedup отсутствует на финансовой границе. Telegram не хранит необработанные updates бесконечно: [Bot API](https://core.telegram.org/bots/api#getting-updates). |
| AI/speech/OCR | Groq→rules, Google speech fallback; synchronous decode/OCR | Таймаут SDK не считать отсутствующим без проверки его версии. Но общего bounded end-to-end deadline/очереди и безопасной семантики fallback нет. Нужны fault injection и test corpus. |
| SQL persistence | SQLite/PostgreSQL, silent fallback, catch-all migrations | Потерянное обновление воспроизведено на SQLite. PostgreSQL isolation/DDL/locking не запускались. Нужны migration parity, atomicity, FK enforcement и restore drill. |
| HTTPS/TLS | ссылки HTTPS; asyncpg ssl=require; нет deployment endpoint под аудитом | BLOCKED: версия TLS, cipher suites, certificate/hostname validation и reverse-proxy configuration live не проверены. Нельзя выдать TLS/RFC8446 PASS по наличию строки https. |
| TCP/QUIC/DNS | собственный транспорт не реализован в архиве | Аудит реализации TCP/QUIC N/A; измерения потерь, RTT, DNS failover BLOCKED без стенда. Настраивать TCP параметры без измерений не предлагается. |
| Browser storage | общие origin keys, unsigned base64 sync, permanent overrides | Это cache, не надёжная база и не аутентификация. Проверить смену identity, storage quota, clear data, race ответов; FE-14 не доказывает remote server compromise. |

## Сценарии отказа и поведение после исправлений

Предлагаемые числа ниже — **начальные проектные настройки для стенда**, не норматив ISO/RFC и не измеренные параметры текущего приложения. После load/fault tests скорректировать по реальным устройствам и плану хостинга.

| Отказ / параметр | Сейчас | Предлагаемый контракт и тест |
|---|---|---|
| API timeout | общий fetch4500ms; refresh3000ms, возможное перекрытие | Read deadline5s; один in-flight query; mutation deadline10s не означает rollback. При timeout после commit lookup по client_id; UI «проверяем сохранение», не повтор с новым ID. |
| Повтор сети/429/503 | fallback success и разрозненные retry | Backoff0.5/1/2s + jitter, максимум3 попытки для разрешённых запросов, учитывать Retry-After и общий deadline. Не переносить эту политику слепо на AI, иначе стоимость/нагрузка умножатся. |
| AI завис/429 | несколько разнородных fallback, без общего бюджета | Text deadline15s, voice/OCR30s; один разрешённый retry при transient error; ручной ввод остаётся доступен. Ограничение2 тяжёлых jobs на локальный экземпляр — стартовая гипотеза для замера. |
| Большой файл | read() целиком, нет прикладного лимита | Начать с10MiB upload,60s audio,20MP image; проверять реальный decoded размер и MIME. Выбрать значения после тестов типичных чеков, показать пользователю лимиты. |
| База недоступна | другая SQLite создаёт видимость работы | /livez продолжает показывать живой процесс; /readyz503; записи запрещены, черновик сохранён отдельно. Не переключать источник финансовой истины автоматически. |
| Разрыв/краш после commit | уведомление может не прийти | Команда хранит результат+idempotency; durable notification/outbox при необходимости. Рестарт+повтор возвращают тот же transaction ID. |
| Конкурирующие операции | stale balance перезаписывается | Тест100 команд и edit/delete contention: нулевая необъяснимая дельта баланса. Для горячих счетов измерить DB latency/lock retries отдельно. |
| Сон/перезапуск Mac | процесс доступен только когда среда работает | Local learning mode честно не24/7. После wake/restart проверить poller, очередь, БД и drafts. Для постоянного сервиса перенести runtime на always-on host с persistent DB. |
| Recovery | восстановление в архиве не доказано | Предложение для небольшой beta: backup ежедневно + перед migration; RPO≤24h при потере хоста, RTO≤60min после получения backup. Это цели, пока не выполнен restore drill. Внутри штатного restart confirmed records теряться не должны. |
| Секрет попал в bundle/image | .dockerignore отсутствует | Проверка контекста/образа, отдельные dev/prod keys. Rotation только если реальная экспозиция установлена; факт утечки в ZIP не подтверждён. |
| UI потерял сеть | операции выглядят сохранёнными | Draft / pending / confirmed / failed явные; финансовый успех только после server acknowledgement. Offline mode не обещает синхронизацию, пока outbox не реализован и не проверен. |

Предлагаемые acceptance metrics: 0 duplicate ledger records на100 повторов одного ключа; 0 разницы reconciliation по каждой валюте; 0 межпользовательских чтений/изменений в матрице тестов; p95 обычного CRUD<500ms на согласованном локальном/серверном стенде без внешнего AI. Никаких фактических p95/SLA в этом аудите не измерено.

## ISO-oriented gaps и свидетельства закрытия

| Область управления | Пробел по доступному архиву | Что подготовить до расширения использования |
|---|---|---|
| Scope и владельцы | Неясны аудитория, место хостинга, регион обработки, shared-account semantics | Одностраничный scope, перечень активов/поставщиков, владелец каждого риска, критерии допустимого ущерба |
| Контроль доступа / конфиденциальность | SEC-01/02/03, FIN-01, FE-14 | Auth matrix и результаты двух пользователей; журнал прав; cache isolation; ссылки без финансов |
| Целостность | money/parser/concurrency/seed findings | Money contract, reconciliation, audit event, test matrix и migration report |
| Доступность / непрерывность | silent DB fallback, Mac sleep, static health | Заданные RPO/RTO, backup inventory, отдельный restore drill и incident runbook |
| Безопасная разработка / изменения | неполные тесты, незакреплённые backend deps, большой дублированный код | Малые PR, review, CI, lock, dependency inventory, rollback и документированные acceptance |
| Поставщики AI/hosting | fallback меняет обработчика данных, free tier обещан без условий | Data-flow map, тариф/регион/retention проверены, выбор провайдера, минимизация payload |
| Логи / инциденты | transcript INFO и raw exceptions; нет доказанного реагирования | Редакция logs, correlation ID, retention, кому сообщать и как блокировать запись при инциденте |
| Проверка и улучшение | текущий набор закрепляет demo/upsert, мало негативных сценариев | Risk register, evidence links, план повторного аудита после A1–A8 и журнал незакрытых рисков |

Наличие документа в ZIP не доказывает, что организационная процедура действует; отсутствие файла не доказывает, что у Алины нет такой процедуры вне архива. Формальный compliance требует отдельной работы со scope, лицензионным стандартом и свидетельствами организации.
