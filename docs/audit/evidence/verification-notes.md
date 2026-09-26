# Isolated runtime verification

Date: 2026-09-26. Original work/source never changed by this verifier. Copied source to work/verification before tests/build. Python 3.11.9, Node v25.8.1, npm 11.11.0 on Windows. MacBook runtime not verified.

## Commands

- `Copy-Item -LiteralPath work/source -Destination work/verification -Recurse`
- In work/verification/bot: environment GROQ_API_KEY='', GEMINI_API_KEY='', BOT_TOKEN='123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', DATABASE_URL='sqlite+aiosqlite:///:memory:', PYTHONPATH=current directory; `python -m pytest -q`.
- Same environment, PYTHONIOENCODING=utf-8: `python ../runtime_probe.py`.
- In work/verification/frontend: `npm ci --ignore-scripts`, `npm run build`, `npm audit --json`.

## Results and limits

Existing pytest: 7 passed in 1.01s. The tests expressly accept demo identity and unknown-ID upsert; passing does not establish correct security or financial invariants.

No original app lifespan/server/polling was started. Auth tested via a tiny local FastAPI probe endpoint using the real get_current_user_id dependency. DEBUG=False throughout auth probes. No credentials yields HTTP200 user123456789, invalid signature also yields user123456789; arbitrary user_id=424242 and X-User-Id=434343 yield those identities. Real validator accepts correctly HMAC-signed auth_date=1 (Unix time one second), user454545. This is an isolated code behavior proof, not a probe against a deployed service.

AI fallback tested with API keys disabled and no AI/network calls. Actual inputs/results:
- Кофе 250.50 => amount50, category Покупки.
- Кофе 250,50 => amount50, category Покупки.
- Кофе 1 500 => amount1.
- Кофе 26/09 500 => normalized26009 500 => amount26009.
- Кофе 0.1+0.2 => normalized0.30000000000000004 => amount30000000000000004.
- Кофе 200 и маникюр => only200 recorded in parsing result, no pending clarification.
- Кофе -250 => positive250 expense.

See runtime-probe.log for machine-readable full outputs. Probes did not persist transactions; subsequent storage of these amounts is outside this probe.

npm ci --ignore-scripts: 146 packages installed, exit0. npm audit --json: vulnerabilities total0, exit0. Registry audit is limited to known advisories reported at execution; it is not proof of application security. Build result in frontend-build.log.

No browser acceptance, MacBook launch/sleep/restart, PostgreSQL integration, real Telegram authentication exchange, provider failure tests, external API charges, or live load tests were performed.

Build completed successfully: TypeScript plus Vite6.4.3, 1763 modules,19.44s. Output JavaScript373.47kB (gzip102.15kB). Browser behavior remains untested.

Python launcher `py -0p` lists only Python3.14 and3.11; Python3.12 was not available. Test runtime package versions: FastAPI0.135.2, SQLAlchemy2.0.48, Pydantic2.11.10, pydantic-settings2.14.2, pytest9.0.3, pytest-asyncio1.3.0, aiosqlite0.21.0, httpx0.28.1. These describe the existing verification environment, not a reproducible production lock.

Reproduction script copied to work/audit/runtime_probe.py. It must be run with PYTHONPATH pointed at work/verification/bot and the blank/fake environment above.

Python requirements audit: `python -m pip_audit -r requirements.txt -f json -o ../../audit/pip-audit.json --progress-spinner off --timeout 15` completed exit0, No known vulnerabilities found. This resolves the open-ended requirements on Python3.11/Windows at audit time into a temporary environment; it does NOT verify Alina's installed versions or MacBook environment. Full resolved dependency versions in pip-audit.json, diagnostics in pip-audit.log. No fixes/installations to global runtime requested or performed.
