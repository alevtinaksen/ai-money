# AI Money project contract

Explain outcomes in clear Russian. Preserve the user's requested scope and finish authorized reversible local work. Prefer careful evidence and maintainability over speed; do not claim longer deliberation alone guarantees correctness.

Before a substantial change, read README.md, docs/QUALITY.md and the nearest feature documentation. Map callers, data contracts and failure cases. Record implemented versus planned behavior. Keep private AI memories and global application settings outside this repository.

## Ownership and structure

- Backend: bot/app/api for HTTP boundaries, services for business operations, domain for shared invariants, schemas/models for transport/storage. Avoid business logic duplicated between bot and API.
- Frontend: frontend/src grouped by feature, with shared primitives only after real reuse. Name modules for what they own; Python snake_case, React components PascalCase, other TypeScript camelCase. No final2/new/copy/backup source modules.
- Tests live with the relevant test suite; scripts contains project tooling; docs contains maintained decisions. Scratch output goes in ignored work/. Never store secrets or real personal data in examples/tests.
- Prefer feature-sized modules. Python 500 lines and JS/TS 300 lines are review signals. scripts/structure_check.py rejects oversize maintained modules unless docs/workflow/structure-exceptions.json contains a specific reason and bounded maximum. Never split mechanically: preserve transaction boundaries, error behavior and contracts. Existing exceptions cannot silently grow.

## Required work cycle

1. Identify observable behavior and risks before editing; for meaningful behavior changes or refactoring add a regression covering the real failure or contract.
2. Make a cohesive narrow change; update feature documentation in the same slice.
3. Run targeted tests, then python3 scripts/project.py quality. Treat FAIL and unavailable checks honestly. Reading code, parsed JSON or HTTP 200 alone are not runtime acceptance.
4. For UI, sketch the proposed arrangement in text before implementation, then check empty/loading/error and mobile states. Request a separate review when agents are actually available; otherwise perform and label a second review pass yourself.
5. Report actual tests and remaining limits. Local preflight does not authorize deployment or prove macOS/Telegram acceptance.

No automatic deploy/push, token copying, global configuration changes, private-memory transplantation or destructive data operations. User authorization governs external changes. Development launch is loopback-only; never publish local-login mode.
