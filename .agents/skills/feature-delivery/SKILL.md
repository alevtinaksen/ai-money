---
name: feature-delivery
description: Implements substantial AI Money features across the API, bot or frontend with shared contracts and regression evidence. Use for behavior changes rather than text-only edits.
---

Read repository AGENTS.md and docs/QUALITY.md. Identify the user's observable outcome and affected routes, services and UI states. Sketch user-facing changes before code. Choose one owner for each responsibility and preserve shared API/bot business logic.

For each slice, state the failure case or new behavior, add a meaningful regression, implement the smallest coherent change, and update adjacent docs. Reuse existing features before new dependencies. Run targeted tests and the project quality command. A missing command or unavailable runtime remains a failed/unverified check, never a pass.

If actual independent agents are available and the user authorized delegation, assign isolated ownership and ask a reviewer to inspect the result. Otherwise work sequentially and label self-review. This skill itself is not a native IDE subagent.
