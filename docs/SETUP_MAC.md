# Запуск на Mac

Это локальная установка внутри папки проекта. Глобальные конфиги Antigravity и личная память не меняются. Работа IDE на вашем Mac пока не проверена.

1. Установите Python 3.12+ с python.org и Node.js 22 LTS либо новее с nodejs.org. Откройте папку проекта в Antigravity. Встроенный Terminal должен находиться в ней: команда `pwd` показывает выбранную папку.
2. Выполните `python3 --version` и `node --version`. Если Python ниже 3.12, используйте установленный `python3.12` вместо `python3` далее.
3. Выполните `python3 scripts/project.py setup`. Скрипт создаёт .venv, устанавливает зависимости Python и npm ci, копирует отсутствующие bot/.env и frontend/.env, настраивает только проектный hook. Существующие .env сохраняет; прежний hook-конфиг при изменении резервирует в work/setup-backups. Сеть нужна для загрузки пакетов.
4. Выполните `python3 scripts/project.py doctor`. MISSING означает незавершённый шаг; UNVERIFIED относится к живому запуску IDE.
5. В первом Terminal: `python3 scripts/project.py backend`. Во втором: `python3 scripts/project.py frontend`. Откройте адрес, показанный Vite: обычно http://127.0.0.1:5173. Остановка — Ctrl+C в каждом окне. Скрипты принудительно используют loopback и отключают Telegram polling пустым BOT_TOKEN.
6. Проверки: `python3 scripts/project.py quality`. Ошибка не маскируется: отчет записан в work/quality/latest.json. Голос/распознавание и Telegram требуют отдельной настройки и не входят в доказательство локального запуска.

Разработка разрешает локальный вход через ALLOW_LOCAL_LOGIN=true. Эту настройку нельзя переносить на публичный сервер. Финансовые данные хранятся локально; не удаляйте базу ради повторной установки.

Telegram запускается отдельным процессом только после настройки вашего BOT_TOKEN в bot/.env: `python3 scripts/project.py bot`. API не должен запускать второй polling-процесс. Не запускайте эту команду, если тот же токен уже используется на сервере. Обычная локальная проверка приложения не требует токена.

Перед изменением существующих данных выполните SQLite backup из [MIGRATION.md](MIGRATION.md). Старую схему приложение намеренно не изменяет автоматически: потребуется экспорт, отдельный импорт и сверка остатков.

## Antigravity

Поддерживаемые проектные пути: AGENTS.md, .agents/rules, .agents/skills, .agents/hooks.json и .agents/mcp_config.json. В меню … → Customizations проверьте правила/навыки/hooks. После установки начните новый разговор и попросите применить evidence-reviewer. При переносе папки повторите `python3 scripts/project.py hooks`, чтобы обновить абсолютную команду hook.

`python3 scripts/antigravity_hook.py --self-test` создаёт только synthetic-hook.json. Реальный hook пишет work/antigravity/live-hook.json при событии PreInvocation. Свежий marker после сообщения IDE вместе с отображением hook в меню — приемочное свидетельство; сам marker может быть подделан ручным вызовом и не является криптографическим доказательством. Ни одна проверка в поставке не заявляет, что ваш IDE уже активирован. Специальная процедура trust/reload зависит от установленной версии и здесь не подтверждена.

MCP Microsoft Learn включён в конфиг как отключённая опция: при необходимости документации Microsoft измените disabled на false в проектном .agents/mcp_config.json и проверьте реальный вызов в MCP Servers. Он не нужен для запуска приложения и не читает ваш диск. GitHub в базовый комплект не подключается; авторизацию выполнять только через поддерживаемый пользовательский OAuth в UI, без передачи токенов в чат/архив.

Официальные контракты, прочитаны 26.09.2026: [Rules](https://antigravity.google/docs/rules?tab=ide), [Skills](https://antigravity.google/docs/skills?tab=ide), [Hooks](https://antigravity.google/docs/hooks?tab=ide), [MCP](https://antigravity.google/docs/mcp?tab=ide), [Learn MCP](https://learn.microsoft.com/en-us/training/support/mcp). [Custom Subagents](https://antigravity.google/docs/subagents/) помечены только 2.0/CLI, поэтому навыки не названы native IDE-субагентами.
