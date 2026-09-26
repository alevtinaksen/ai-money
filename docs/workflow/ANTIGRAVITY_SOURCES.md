# Antigravity IDE: переносимый контракт конфигурации

Дата проверки: 2026-09-26. Метод: прочитаны официальные страницы через web.open, включая отметки Available on и разделы IDE. Исследование standard/deep-research. macOS и установленная версия IDE не доступны для живого запуска: статус ниже означает документированную поддержку, не успешную активацию на машине пользователя.

## Решение для сборки

Использовать workspace `.agents/` и корневой `AGENTS.md`; глобальные настройки не менять. Добавить навыки, правила, native IDE hooks и один публичный MCP документации. Роли IDE реализовать навыками. Настоящие custom-subagents оставить отдельным необязательным адаптером для Antigravity 2.0/CLI, явно не обещая их активацию IDE. Это вывод по разграничению поверхностей в источниках ниже.

## Правила

Подтверждено для IDE: `AGENTS.md`/`GEMINI.md` в корне и подкаталогах, `.agents/rules/*.md`; старый `.agent/rules/` совместим. Глобальные пути: `~/.gemini/AGENTS.md`, `~/.gemini/GEMINI.md`, `~/.gemini/config/rules/*.md`. Для переносимого набора глобальные пути не нужны. `AGENTS.md` — обычный Markdown без frontmatter. В `rules/*.md` требуется `trigger`; допустимы `always_on`, `model_decision`, `glob`, `manual`. `model_decision` требует description, `glob` требует globs. Неверный trigger/отсутствующий frontmatter означает пропуск правила. Подкаталоги rules автоматически не сканируются.

Собственный минимальный пример `.agents/rules/evidence.md`:

```yaml
---
trigger: always_on
description: Evidence and verification requirements for this project.
---
Report checks actually executed. Mark unavailable runtime verification explicitly.
```

Источник: [Rules, YAML frontmatter and IDE locations](https://antigravity.google/docs/rules?tab=ide), прочитаны строки 184–254, 319–337.

## Навыки и роли

IDE загружает `.agents/skills/<name>/SKILL.md`, глобально `~/.gemini/config/skills/<name>/`; legacy `.agent/skills` поддерживается. Frontmatter требует `description`, `name` необязателен. При начале разговора публикуется перечень навыков, содержимое читается при выборе. Проверка списка: меню Customizations боковой панели. Для обновления пакета рекомендуем новый разговор и явное упоминание навыка — это приемочный шаг, не доказанный обязательный restart.

```yaml
---
name: evidence-reviewer
description: Reviews project evidence and checks whether completion claims are supported.
---
Inspect existing evidence without modifying source files. Return findings with file and line references.
```

Источник: [Agent Skills](https://antigravity.google/docs/skills?tab=ide), разделы Frontmatter fields и Antigravity IDE skill locations.

Страница [Custom Subagents](https://antigravity.google/docs/subagents/) явно помечена **Antigravity 2.0 / Antigravity CLI**, без IDE. Ее `.agents/agents/<name>.md` и `.agents/agents/<name>/agent.md` нельзя выдавать за подтвержденные IDE-интерфейсы. Для отдельного 2.0/CLI-адаптера документированы frontmatter `name`, `description`, `tools`, `mainAgent`, `subagent`, `model` (`inherit`, `flash`, `pro`), `commandExecutionPolicy` (`off`, `auto`, `eager`, `sandbox`). Опечатки в tools могут вызвать зависание; не переносить имена инструментов Codex.

## Native IDE hooks

IDE: `.agents/hooks.json`, глобально `~/.gemini/config/hooks.json`; управление: `… > Customizations > Hooks`. Корень JSON — именованные hooks. События: `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`. Tool-events используют matcher/hooks, остальные — список handlers непосредственно. `timeout` в секундах; `enabled` по умолчанию true. stdin/stdout — JSON, поля camelCase: `toolCall.name`, `toolCall.args`, `workspacePaths`, `conversationId`. PostToolUse возвращает `{}`. PreInvocation допускает `injectSteps` с `ephemeralMessage`. PreToolUse решения: `allow`, `deny`, `ask`, `force_ask`, `deny_unless_prior_grant`. Stop: `decision: continue` повторяет цикл; любое другое значение завершает.

Собственный адаптированный пример:

```json
{
  "project-evidence-reminder": {
    "enabled": true,
    "PreInvocation": [
      {"type": "command", "command": "python3 scripts/antigravity_hook.py", "timeout": 10}
    ]
  }
}
```

Вывод скрипта:

```json
{"injectSteps":[{"ephemeralMessage":"Check project evidence before claiming completion."}]}
```

Источник: [Hooks](https://antigravity.google/docs/hooks?tab=ide), IDE/schema/events/I/O. Не использовать Gemini CLI `BeforeTool`/snake_case. Отдельная процедура trust, reload semantics и cwd hooks не установлены; абсолютный путь команды лучше генерировать установщиком после выбора папки. JSON-проверка не доказывает исполнение hook.

## MCP

IDE: workspace `.agents/mcp_config.json`, global `~/.gemini/config/mcp_config.json`. UI: `… > MCP Servers > Manage MCP Servers > View raw config`. Корень `mcpServers`, удаленный транспорт `serverUrl`; локальный `command` с `args`, `env`, необязательным `cwd`. Документированы `headers`, `disabled`, `disabledTools`; OAuth без дополнительных полей автоматически работает у серверов с DCR. Не заменять `serverUrl` полем `url`/`httpUrl`. Не писать `~/.gemini/settings.json` как IDE MCP-конфигурацию.

Источник: [MCP](https://antigravity.google/docs/mcp?tab=ide), строки 244–304, OAuth. Runtime не проверен.

Рекомендованный минимальный профиль:

```json
{
  "mcpServers": {
    "microsoft-learn": {
      "serverUrl": "https://learn.microsoft.com/api/mcp"
    }
  }
}
```

[Microsoft Learn MCP](https://learn.microsoft.com/en-us/training/support/mcp) документирует Streamable HTTP, отсутствие обязательной аутентификации, поиск/чтение публичной документации и примеров. Это узкий read-only источник документации Microsoft, **не** база ISO/RFC и не доступ к локальному диску. Профиль — пример совместной композиции официального endpoint и официальной Antigravity-схемы, не проверенное соединение IDE. Для ISO/RFC использовать первичные сайты отдельно.

## Необязательный GitHub

Отключенный шаблон, не активировать установкой пакета:

```json
{
  "mcpServers": {
    "github-readonly": {
      "serverUrl": "https://api.githubcopilot.com/mcp/",
      "headers": {"X-MCP-Readonly": "true"},
      "disabled": true
    }
  }
}
```

Endpoint: [GitHub Remote Server](https://raw.githubusercontent.com/github/github-mcp-server/main/docs/remote-server.md). Заголовок read-only: [GitHub Server Configuration](https://raw.githubusercontent.com/github/github-mcp-server/main/docs/server-configuration.md). Подключение требует пользовательской авторизации. [GitHub Host Integration](https://raw.githubusercontent.com/github/github-mcp-server/main/docs/host-integration.md), строки 63–107, предупреждает: remote GitHub DCR не поддерживается. Поэтому URL-only OAuth для Antigravity не доказан. Рекомендуется встроенный Store OAuth, если он доступен установленной версии; до успешного входа сервер остается отключенным. Токены/секреты в пакет не добавлять. Доступность такого Store-flow на целевом Mac — [UNVERIFIED].

## Активация и приемка

Точный отдельный trust-flow IDE для hooks в прочитанных источниках не описан; нельзя переносить Codex `/hooks` trust или Gemini CLI approval-процедуру как факт. Страницы [Permissions](https://antigravity.google/docs/permissions/) и [Agent Settings](https://antigravity.google/docs/agent-settings/) имеют метки 2.0/CLI и 2.0 соответственно; их глобальные presets также нельзя автоматически записывать в IDE.

Проектный приемочный протокол (рекомендация):

1. Зафиксировать версию IDE и открыть установленную папку как workspace.
2. В Customizations убедиться, что отображаются правила, навыки и hook; проверить, что hook включен.
3. Новый разговор: попросить назвать одно специально заданное проектное правило и применить evidence-reviewer.
4. Выполнить безвредный hook-probe: сам handler должен записать только счетчик/время в проектный work, без содержимого prompts и transcript. Доказательство — свежий marker, а не существование JSON.
5. В MCP Servers проверить соединение, затем вызвать публичный поиск документации и получить конкретную страницу. HTTP 200 сам по себе недостаточен.
6. GitHub не обязателен для прохождения базовой приемки; OAuth выполняет пользователь в UI, затем проверяется read-only набор инструментов.

Ограничения: текущий Mac/IDE, минимальная версия функций, hook cwd, trust/reload, OAuth GitHub не проверены. Документация по общим инструментам hooks перечисляет invoke_subagent, но отдельная страница subagents исключает IDE из availability; это противоречие разрешено консервативно, без обещаний IDE subagents.

Контекст памяти использован только как указатель на прошлое различие file-level/live activation (`MEMORY.md:237–242`), все интерфейсы выше сверены заново.
