# Independent delivery review — checkpoint

Scope: work/delivery/ai-money. Read-only review of product source; only reviewer scripts/logs written under work/audit. Other agents actively developing, so this checkpoint does not certify final archive.

## Findings and retest

1. Fixed: bot/app/main.py static asset resolution used parents[3], pointing outside project. Parent corrected to parents[2]. Actual repository path calculation now matches root/frontend/dist. Full HTTP static smoke deferred until final build.
2. Fixed: bot/app/bot/handlers/safe_flow.py preview truncated a 20-row draft at4000chars then offered confirm-all. Independent delivery-preview-probe.py reproduced hidden final row before fix. After fix, complete preview split into pages and final row20 visible; last page1458chars, confirmation only on final page. Telegram delivery itself not tested.
3. Fixed: Content-Length-only cap allowed unauthenticated chunked multipart to be entirely consumed before401. Independent delivery-upload-probe.py reproduced100000bytes with100byte configured file cap. New ASGI middleware inspected and retested on real route:6MB chunked input stopped with413 after5309000 file bytes (configured5MiB file limit plus65536 total-body allowance). No credentials/provider/API calls.

## Independently executed

- Initial Python3.11 run: toolkit unittest6 PASS, structure0 failures; whole pytest collection temporarily failed because import worker created tests before bank_import module. This is an in-progress snapshot, not counted as final regression.
- Python3.12 project .venv: selected test_security.py + test_ai_preview.py + test_finance.py:29 PASS in4.85s.
- delivery-durable-probe.py on temporary disk SQLite with project3.12: foreign owner confirmation rejected; first confirmationTrue; replayFalse;2transactions; second draft first valid/second bad item fails; count remains2; failed draft returns pending; account balance-69.12. No leftovers in original database.
- delivery-upload-probe.py:413 for oversized chunked multipart.
- delivery-preview-probe.py: final row visible after pagination change.

Scripts saved adjacent to this report. Environment: PYTHONPATH=delivery/bot, DATABASE_URL=sqlite+aiosqlite:///:memory:, BOT_TOKEN blank, AI_PROVIDER disabled; project .venv/Scripts/python.exe. Tests do not start Telegram polling or contact Gemini.

## Verification limits

Full latest quality/preflight/build and real static serving pending stable worker completion. Mac launch, restart/sleep behavior, Antigravity actual hook discovery, cloud provider/model availability, live Telegram delivery, PostgreSQL deployment remain unverified; synthetic tests do not establish these.

## Integration checkpoint — PostgreSQL and current suite

Independently executed full backend suite on project .venv Python3.12:42 passed in10.65s (delivery-pytest-final.log). This precedes latest timezone and dependency-pin fixes; final frozen gate must supersede it.

PostgreSQL16 actual local Docker test: created only ai-money-pg-verify, bound127.0.0.1:55439, synthetic DB/user/password, containerID9975ef9a9f4c3856092afec4485af5018609993ba8a3ebb8dcf73ba6173b1d7f. All assertions in delivery-postgres-probe.py completed successfully on first run (exit0): schema init twice;20 concurrent spends of0.01 =>99.80 from100; raw BIGINT9980; foreign account ownership rejected; concurrent same-batch confirmations returned confirmed/conflict; replay same transaction; duplicate preview marked; failure in second imported row rolled back first; final87.46 and21transactions; unsupported schema99 rejected. Evidence delivery-postgres.log. This proves the specified paths on PostgreSQL, not a hosted Supabase deployment or load SLA.

Limit: first successful Windows run also emitted asynchronous Proactor transport WinError10022 callback during connection cleanup. Attempts to repeat with Selector policy and default policy hung with PostgreSQL sessions idle; stopped only the two known verifier Python process trees. They do not provide a second PASS. Removed only owned ai-money-pg-verify after verifying exact containerID/image/binding. No other Docker services altered. Thus first run is qualified PASS with a local transport/cleanup repeatability issue; production/macOS behavior is not established.

Additional real issues sent to owners:
- SQLite UTC serialization: UTC input12:00+00:00 serialized12:00 withoutZ; frontend interprets as local, edit shifts time. Reproduced delivery-date-probe.py. Finance owner correcting response normalization and regression.
- BankImport account/file selectors retained an old preview batch; confirming after changing visible account could book into old account. Frontend owner correcting reset and authoritative batch-account display with tests.

These two are pending reviewer retest at this checkpoint; do not carry them as open after a successful frozen retest. Source remains untouched by reviewer.

Retest after timezone correction: backend43 passed in10.27s (delivery-backend-retest.log). Independent SQLite date probe now returns2026-09-01T12:00:00Z; timezone serialization blocker CLOSED. Frontend preview-reset code is present, but new tests still in progress:32passed/2failed in BankImport.test.tsx (could not reach mocked preview). Not a frozen-final result; await developer's corrected fixture and rerun.

## PostgreSQL repeatability CLOSED with Linux proof

Two independent fresh databases (money_verify and money_verify_repeat) tested using Python3.12 inside local image ai-money:handoff (imageID4fd8562cc2402d8b9f3f5df98407c436e6e5c4134d7840427d38f21f5c416c26), current delivery/bot/app bind-mounted read-only and same probe read-only. PostgreSQL16 isolated own container ai-money-pg-verify; test runner used --network container:ai-money-pg-verify, no host port published. First initial connection raced server startup (connection refused); after pg_isready success both complete assertion runs exited0 in~3seconds without callback errors/hangs. Logs: delivery-postgres-linux-1.log and delivery-postgres-linux-2.log. Both prove schema init/rejection,20concurrent exact-cent spends,ownership checks,concurrent import/replay/dedup and full partial-batch rollback. The Windows transport anomaly is now isolated to the Windows-host test route; the Linux repeatability concern is CLOSED. No inference about production SLA/macOS/cloud deployment. Owned postgres containerIDe21f2f0378cad5a426d5ff64ddc6d284eceb2f1ed59614ad618e5a9f0bf6d11b verified then removed; probe containers used --rm.
