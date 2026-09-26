---
name: safe-refactoring
description: Refactors AI Money modules while preserving observable behavior. Use for oversized modules, duplicated responsibilities or tangled dependencies, not for new feature implementation.
---

Read AGENTS.md and docs/workflow/README.md from the repository root. List callers and externally visible behavior, including errors, money rounding, user scoping and transaction atomicity. Establish passing regression coverage before moving code. If the baseline is red, isolate the failure before claiming preservation.

Extract one cohesive feature boundary at a time and rerun relevant regressions. Avoid generic utility dumping grounds and cyclic imports. Size thresholds trigger review; never divide a transaction or feature arbitrarily. If keeping a large module is justified, document a bounded exception with a concrete follow-up in docs/workflow/structure-exceptions.json.

Run python3 scripts/project.py quality and inspect the diff for unintended changes. Update feature docs in the same change. Do not deploy or create commits/pushes without the user's applicable authorization.
