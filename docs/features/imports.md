# CSV statement review and import

Implemented canonical CSV MVP. This is not a universal bank connector: direct bank APIs,
credentials, XML, proprietary Excel statements and automatic bank synchronization are unsupported.
Export/convert to the documented UTF-8 CSV first. No bank passwords are requested or stored.

## Accepted file

UTF-8 (BOM optional), comma-separated, header required; at most 1 MiB and 1000 data rows.
Required columns: `date,amount,currency,description`. Optional: `source_id,status,type`.

```csv
date,amount,currency,description,source_id,status
2026-09-01,-10.25,RUB,Groceries,example-001,posted
2026-09-02,100.00,RUB,Income,example-002,posted
```

Negative amount means expense, positive means income. Zero, nonfinite amounts, fractions below
one cent, malformed date and currency different from the selected account are rejected per row.
Dates normalize to UTC. Status defaults to `posted`; pending/other statuses cannot be imported.
A row marked `type=transfer` is excluded: review transfers and create a paired transfer manually
between your own accounts. Unmarked bank transfers cannot reliably be inferred from free text;
the user must skip them in preview. This limitation is visible in the product instructions.

## Review contract

`POST /api/imports/preview` multipart `file` + `account_id` creates a persisted draft only.
Response and `GET /api/imports/{id}` return `{id,account_id,revision,status,rows,transaction_ids}`.
Rows expose `id,date,amount,currency,description,source_id,status,type,category_id,note,include,
duplicate,force_duplicate,error`. Amount is a canonical decimal string.

`PATCH /api/imports/{id}/rows/{row_id}` requires `revision`, and accepts only changed `include`,
`type` (income/expense), `category_id`, `note`, `force_duplicate`. Original date, amount, currency
and source ID remain immutable. An edit increments batch revision. Error rows cannot be included.
Changing the category to an inaccessible or incompatible category will fail confirmation atomically.

`POST /api/imports/{id}/confirm` requires `{revision,row_ids:[explicitly selected row IDs]}`.
Only selected included valid rows are applied; selecting nothing is rejected. The whole batch is
one transaction. Invalid account/category or duplicate identity rolls back every row and balance.
Repeated confirmation with exactly the same selected IDs returns the existing result. Another
selection or stale revision conflicts (409). Confirmed batches cannot be edited.

## Deduplication and privacy

Bank source IDs are deduplicated per user and account with a database UNIQUE constraint. They
cannot be forced through. Without a source ID, date/signed amount/currency/description form a
fingerprint: matches are excluded by default, and an explicit review can allow an intentional
repeat with `force_duplicate=true`. Reimport protection remains after the associated transaction
has been deleted; deletion does not erase the import identity. Duplicate checks run again through
the database constraint during confirmation, protecting concurrent previews/confirmations.

Every batch and related account is tenant-scoped. Drafts contain the uploaded financial rows in
the local configured database; this MVP has no automatic retention cleanup or external upload.
No financial data is put in a URL. Do not share the database as part of a demo or delivery archive.

## Verification

`python -m pytest tests/test_imports.py -q`: seven import tests passed locally. Coverage includes
preview without balance changes, confirmation, owner isolation, immutable source data, retry
identity, deduplication after transaction deletion, explicit fingerprint override, invalid second
row rolling back the first, invalid/pending/transfer exclusion, byte/row bounds, and simultaneous
confirmation through separate file-backed SQLite sessions. This uses synthetic CSV, not a live
bank export. PostgreSQL concurrency and bank-specific formatting remain unverified.

Source: [models](../../bot/app/models/imports.py), [CSV parser](../../bot/app/services/bank_import_csv.py),
[service](../../bot/app/services/bank_import.py), [routes](../../bot/app/api/routes/imports.py),
[tests](../../bot/tests/test_imports.py).
