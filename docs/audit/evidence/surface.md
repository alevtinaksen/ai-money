┌─ SCORE: source · harness · 2026-09-26 · — ─┐
🔴 ВЕРДИКТ: 4.5/10 — слабый — серьёзные дыры, в прод нельзя
Дельта: первая оценка

📊 Сводный вердикт
| Измерение | Было | Сейчас | Потолок | Факт (из чего) |
|---|---|---|---|---|
| **ОЦЕНКА** | — | 🔴 4.5/10 | 🟢 9/10 | закрыть найденное = +4.5 балла |
| Тесты | — | 5 | 5 | 🟢 тестовых файлов: 1 |
| Безопасность | — | 5 | 10 ▲ | 🟢 литералов-секретов в коде не найдено; 🟡 .gitignore отсутствует; 🟢 no unresolved formatted SQL; literal DDL loops excluded; 🟡 bandit (статический сканер): 1 medium+ |
| Качество кода | — | 0 | 10 ▲ | 🔴 ruff (линтер): 41 замечаний — F401×21, E402×14, F541×3, F841×2; 🔴 функций длиннее 50 строк: 13; 🔴 файлов-переростков: 15 |
| Работоспособность | — | 10 | 10 | 🟢 все 24 .py файлов разбираются; 🔴 package.json битый; 🟢 точка входа: bot/app/main.py |
| Git-гигиена | — | 2 | 10 ▲ | 🔴 не под git — истории и отката нет |
| Документация | — | 6 | 10 ▲ | 🟢 README: 121 строк, есть раздела запуска; 🔴 docstring у публичных функций/классов: 11% (13/118) |
| Структура/зависимости | — | 3 | 10 ▲ | 🔴 версии запинены: 0/18; 🟡 lock-файла нет — сборка невоспроизводима; 🟢 в корне 0 .py, масштаб 24 py / 27 js |
| UX/меню | — | n/a | n/a | dynamic callbacks/routing unmeasured: 7; literals: 7 |
| CI/CD | — | n/a | n/a | нет GitHub-remote — CI не применим |
Потолок — РАСЧЁТ, а не обещание: балл, если закрыть ровно найденное. Неизмеренное (n/a) в него не входит — его сначала надо научиться мерить.

🧷 Инварианты JARVIS (уроки памяти → проверки): 2 чисто · 1 сработало · 1 n/a
| | Проверка | Что видно | Урок |
|---|---|---|---|
| 🟡 | inv.dockerignore | build context secret exclusion — Dockerfile: context=., ignore=.dockerignore, .env exclusion=not established | `` |

⭐ Чинить в первую очередь
1. ruff (линтер): 41 замечаний — F401×21, E402×14, F541×3, F841×2 → ruff check --fix, остальное руками
2. функций длиннее 50 строк: 13 → распилить по смыслу (refactoring-engineer)
3. файлов-переростков: 15 → распилить по cohesion

🔎 Доказательства (file:line / вывод)
- `sec.bandit`: .\bot\app\core\config.py:21 B104 MEDIUM
- `inv.dockerignore`: Dockerfile: context=., ignore=.dockerignore, .env exclusion=not established
- `quality.lint`: ruff check .
- `quality.long_functions`: bot/app/bot/handlers/common.py:132 handle_user_input (80 стр.) ⏎ bot/app/bot/handlers/common.py:213 process_and_save_transactions (209 стр.) ⏎ bot/app/bot/handlers/common.py:423 complete_clarification (55 стр.)
- `quality.big_files`: bot/app/bot/handlers/common.py: 539 стр. (порог 500) ⏎ bot/app/services/finance_svc.py: 647 стр. (порог 500) ⏎ frontend/backups/classic_blue_design/App.tsx: 837 стр. (порог 300)