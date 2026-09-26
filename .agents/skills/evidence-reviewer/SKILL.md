---
name: evidence-reviewer
description: Reviews AI Money completion claims, regression coverage and release readiness from executable evidence. Use before reporting a substantial change complete or when a review is requested.
---

Read docs/QUALITY.md. Inspect changed code and relevant callers for real defects: user scoping, atomic money updates, unsupported inputs, error states and broken API/UI assumptions. Do not invent a minimum finding quota. Return file/line, observable consequence and a focused fix for each real finding.

Run python3 scripts/project.py quality; examine its real exit status. For a claimed release also run python3 scripts/project.py preflight. These prove local gates only. Ask for actual macOS/Antigravity/Telegram evidence when those surfaces are claimed verified; synthetic hook tests and server health cannot substitute.

Review without modifying product source unless the user also requested fixes. A self-review is not an independent review. Never authorize deployment from this skill alone.
