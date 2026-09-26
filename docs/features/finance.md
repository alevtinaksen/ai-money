# Financial ledger contract

Implemented locally; deployment and real Telegram acceptance are separate release checks.

## Data ownership and initialization

Every public financial operation is scoped to the authenticated Telegram user. Source account,
transfer destination, category and category parent must belong to that same user. Request bodies
cannot override `user_id` or record IDs. All GET endpoints are read-only.

Explicit onboarding calls `FinanceService.ensure_user_seeded`: one zero-balance generic account,
four generic categories, no historical transactions. `finance_users` records completion so deleting
or archiving data cannot resurrect defaults. No embedded personal financial records remain in the
finance service. `get_user_sync_hash` returns an empty string: financial data never belongs in a URL.

## Exact money and atomic changes

Amounts are finite positive Decimal values, at most 999999999999.99, with no fractional cents.
Invalid amounts are rejected, never rounded silently. Transaction dates supplied through HTTP must
include a timezone offset; naive dates are rejected. All API created_at timestamps carry UTC,
including SQLite values whose database driver strips timezone information. All database money columns use integer cents
(`models/money.py`); this also avoids SQLite's floating-point NUMERIC behavior. Opening balances
may be signed. Every account balance is bounded to ±999999999999.99. Atomic SQL updates
check the resulting balance before applying a delta; a fresh database also has a CHECK constraint
in integer cents. Overflow rolls back the entire operation, including both transfer accounts.
Edits apply the net change per account, so a harmless note edit cannot fail on a temporary
reversal at the limit. JSON account/transaction responses expose numbers for the UI boundary.

An expense decreases its account; income increases it; a transfer decreases its source and increases
its destination by the identical amount. Transfers require distinct active accounts in the same
currency and have no category. Currency conversion is intentionally unsupported.

Transaction creation and balance deltas commit together. Deltas use SQL `balance = balance + delta`,
not read-modify-write in Python. Updates and deletes compare an explicitly supplied revision in
SQL and increment it; a stale revision raises `ConflictError` (HTTP 409). Unknown PUT IDs return
404 and never insert. Invalid linked IDs are validated before mutation. Deleting a transaction
reverses its effect and leaves a tombstone to preserve idempotency identity.

The `(user_id, client_id)` database uniqueness constraint protects concurrent requests. The same
key and canonical creation payload return the existing operation. A changed payload or a deleted
operation with that key produces 409. Clients should retain their key while retrying a request.
For import batches, `create_transaction(..., commit=False)` flushes inside a savepoint while the
caller owns the outer commit/rollback. The SQLite branch establishes a real outer write transaction
before its savepoint so rollback does not accidentally persist a released outermost savepoint.

## HTTP contracts

- `GET/POST /api/accounts`: list active accounts / create with explicit opening balance.
- `GET /api/accounts?include_archived=true`: include archived metadata.
- `PUT /api/accounts/{id}`: metadata only; direct balance/currency rewriting is rejected.
- `DELETE /api/accounts/{id}`: archive; preserve transactions and money.
- `GET/POST /api/categories`, `PUT/DELETE /api/categories/{id}`: create/update/archive categories.
  Type is `expense`, `income` or `both`; optional `parent_id` must be owned and acyclic.
  A parent with active children cannot be archived until they are moved/archived.
- `GET /api/transactions?limit=50&offset=0`: stable newest-first order by time and ID.
  Limits: 1–100; offsets: 0–100000; optional month_offset and currency filters.
- `POST /api/transactions`: account_id, amount, type plus optional to_account_id, category_id,
  note, created_at and client_id. Response includes id, revision and currency.
- `PUT /api/transactions/{id}`: mandatory revision plus changed fields.
- `DELETE /api/transactions/{id}?revision=N`: mandatory current revision.
- `GET /api/analytics/dashboard?month_offset=0&currency=RUB`: UTC calendar-month SQL aggregates.
  Offsets are bounded to ±120 months. `balances_by_currency` and `totals_by_currency` preserve
  currency separation; legacy total_balance/period_income/period_expense refer only to selected
  currency. Category totals cover every operation in the selected month/currency. Recent history
  remains independently limited to 20 records. Archived accounts remain in financial totals.

## Verification

`cd bot && python -m pytest tests/test_finance.py -q`: 18 tests passed locally on Python 3.11;
source targets Python 3.12+. `tests/test_finance_timezones.py` additionally verifies the HTTP
UTC create/list/edit roundtrip, account/category timestamps, and rejection of naive inputs.
`tests/test_finance_bounds.py` covers both balance limits, transfer rollback, and net edit deltas. Nine first regressions failed against the original implementation,
then passed after fixes. The original tests expecting personal demo balances, unauthenticated demo
login, guessed AI amounts and unknown-ID upserts were replaced because those expectations encoded
the audit defects. Authentication and AI behavior are tested in their own owner-maintained suites.

Regression coverage includes empty pure reads; onboarding without resurrection; invalid money;
foreign account/category on create/edit; invalid transfer unchanged; revision-aware edit/delete;
create/retry/delete identity; >20 operations over multiple periods; separate currencies; archived
history; exact maximum cents and repeated fractions; transfer conservation; category ownership and
cycle detection; outer batch rollback; concurrent independent-session deltas, edit conflicts, and
idempotent creation. Concurrency was executed against file-backed SQLite. PostgreSQL concurrent
execution is not verified locally; it uses the same UNIQUE/CAS/atomic SQL mechanisms.

Implementation: [facade](../../bot/app/services/finance_svc.py),
[transaction engine](../../bot/app/services/finance_transactions.py),
[analytics](../../bot/app/services/finance_analytics.py),
[models](../../bot/app/models/models.py), [schemas](../../bot/app/schemas/finance.py),
[regressions](../../bot/tests/test_finance.py).
