# Воспроизведение и ограничения доказательств

Используйте отдельный каталог `audit-run` с подкаталогами `source/` (распакованный оригинальный ZIP) и `audit/` (копия файлов из evidence). Не запускайте на рабочем проекте с настоящими .env/базами. Файлы архива должны совпасть с baseline.json. Скрипты являются диагностическими артефактами, не патчами приложения.

## Финансовые сценарии

Из `audit-run`:

```sh
python -B audit/finance_probe.py --source source
```

Требуются SQLAlchemy,aiosqlite,Pydantic из проверенного окружения. Скрипт использует настоящий сервис, но заменяет database module внутри процесса минимальным Base; только SQLite :memory:. Поэтому он доказывает конкретные ошибки сервиса и ORM, но не работу init_db, миграций PostgreSQL, startup или auth.

## Auth и rule parser

Из `audit-run/source/bot` (синтаксис macOS shell; на Windows использовались эквивалентные env переменные):

```sh
PYTHONPATH="$PWD" PYTHONDONTWRITEBYTECODE=1 \
GROQ_API_KEY='' GEMINI_API_KEY='' \
BOT_TOKEN='123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' \
DATABASE_URL='sqlite+aiosqlite:///:memory:' \
python ../../audit/runtime_probe.py
```

В изолированной распаковке нет .env. Токен здесь фиктивный, сети нет. Проба создаёт локальный ASGI TestClient endpoint с настоящим get_current_user_id, не запускает app.main/lifespan и polling. Вывод зафиксирован в runtime-probe.log.

## Frontend probe

Из `audit-run`:

```sh
node audit/frontend-probe.mjs
```

Проверено Node25.8.1. Скрипт читает source/frontend/src, удаляет import type зависимости для выполнения в Node, использует stripTypeScriptTypes, подменяет fetch/localStorage/window. На более старом Node этот helper может быть недоступен — это ограничение диагностического скрипта, не требование к production runtime. Вывод в frontend-probe-results.json. Настоящие browser DOM, React rendering и Telegram SDK не исполняются.

## Штатные проверки

Точные команды/версии/ограничения приведены в evidence/verification-notes.md. Существующие tests выполнялись в work/verification/bot с пустыми AI keys и in-memory DB; build и npm ci — в отдельной копии frontend. `npm ci --ignore-scripts` исключает lifecycle install scripts. Запуск application server не выполнялся.

pip-audit разрешал незакреплённые требования на дату запуска в своём временном окружении;50 зависимостей без известных advisory — не lock приложения и не проверка Mac Алины. Тесты и pip-audit использовали разные фактические версии; не смешивать их результаты.

## Интерпретация exit codes

exit0 у диагностической программы означает, что она дошла до конца и напечатала результаты, **а не что продукт безопасен**. Пробы в этом пакете демонстрируют ошибки; они не заменяют будущий regression suite с assert правильного поведения. Surface harness exit1 отражает найденные проблемы, но его общий рейтинг исключён из итоговой оценки из-за ограничений обнаружения вложенного frontend и ZIP без Git.

## Контроль исходников и документов

baseline.json содержит SHA256 оригинального ZIP и каждого из67 файлов. Проверка неизменности сравнивает все исходные файлы и сам ZIP; служебные cache-файлы аудитора не являются изменением исходного содержимого. Итог проверки будет в evidence/integrity.json; manifest.json в корне пакета содержит хеши документов и evidence. ZIP отчёта содержит только документы/диагностику, не исходный проект, node_modules или реальные финансовые экспорты.
