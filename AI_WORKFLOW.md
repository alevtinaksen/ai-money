# AI workflow

Read AGENTS.md, README.md, docs/QUALITY.md, docs/workflow/PROJECT_MEMORY.md and the latest HANDOFF.md entry.
A request starts with the observable result, affected contracts and a small plan.
For important logic write a regression that would catch the bug, then implement and run targeted checks.
Run the full quality gate before claiming completion. Keep feature docs updated.
Rules and hooks support this discipline; they do not prove correctness or replace tests.
Do not import private memories or global application credentials from another person's setup.
