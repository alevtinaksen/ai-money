"""Antigravity IDE PreInvocation reminder; records no prompts or secrets."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import time

import structure_check

ROOT = Path(__file__).resolve().parents[1]


def structure_message(root: Path) -> str:
    """Inspect maintained source and bound findings included in model context."""
    try:
        path = root / "docs/workflow/structure-exceptions.json"
        exceptions = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        if not isinstance(exceptions, dict):
            raise ValueError("Invalid structure exceptions")
        failures, warnings = structure_check.inspect(root, exceptions)
    except (OSError, ValueError, TypeError, AttributeError):
        return "Structure scan UNVERIFIED: inspect source access and exception configuration."
    items = ["FAIL " + item for item in failures] + ["WARN " + item for item in warnings]
    if not items:
        return "Structure scan: no naming or size violations in maintained source."
    excerpt = "\n".join(item[:400] for item in items[:8])
    return (f"Structure scan: {len(failures)} failures, {len(warnings)} exceptions.\n{excerpt}\n"
            "Findings limited to eight. Run scripts/structure_check.py for all. "
            "Correct names/imports or refactor by feature with regression tests; never split blindly.")


def handle(payload: dict, root: Path, synthetic: bool = False) -> dict:
    """Validate the IDE event envelope and emit a bounded, non-blocking reminder."""
    workspaces = payload.get("workspacePaths", [])
    if not isinstance(workspaces, list) or not any(
        isinstance(item, str) and Path(item).resolve() == root.resolve() for item in workspaces
    ):
        return {}
    if not isinstance(payload.get("invocationNum"), int):
        return {}
    directory = root / "work/antigravity"
    directory.mkdir(parents=True, exist_ok=True)
    name = "synthetic-hook.json" if synthetic else "live-hook.json"
    marker = {"time": time.time(), "kind": "synthetic" if synthetic else "ide-event",
              "invocation": payload["invocationNum"]}
    (directory / name).write_text(json.dumps(marker) + "\n", encoding="utf-8")
    return {"injectSteps": [{"ephemeralMessage": (
        "Follow project AGENTS.md. Preserve behavior with regression tests. "
        "Before completion run python3 scripts/project.py quality and report actual results. "
        "Group changes by feature; do not split modules mechanically to meet line limits.\n"
        + structure_message(root)
    )}]}


def main() -> int:
    """Use JSON-only stdout so diagnostics never corrupt the hook response."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    try:
        payload = ({"workspacePaths": [str(ROOT)], "invocationNum": 0} if args.self_test
                   else json.load(sys.stdin))
        output = handle(payload, ROOT, args.self_test) if isinstance(payload, dict) else {}
    except (OSError, ValueError, TypeError):
        output = {}
    print(json.dumps(output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
