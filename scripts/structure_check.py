"""Check maintained source modules; explicit bounded exceptions permit safe migration."""
from __future__ import annotations

import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
LIMITS = {".py": 500, ".ts": 300, ".tsx": 300, ".js": 300, ".jsx": 300}


def name_findings(path: Path, relative: str) -> list[str]:
    """Check source naming conventions without renaming files or changing imports."""
    findings = []
    stem = path.stem
    tokens = re.sub(r"([a-z])([A-Z])", r"\1_\2", stem).lower()
    is_backup_feature = relative in {"scripts/backup.py", "scripts/tests/test_backup.py"}
    if not is_backup_feature and re.search(r"(?:^|[_. -])(?:copy\d*|backup\d*|duplicate\d*|final\d+)(?:$|[_. -])", tokens):
        findings.append(f"{relative}: duplicate/backup/final-number source name; choose its feature responsibility")
    if path.suffix == ".py" and not re.fullmatch(r"[a-z_][a-z0-9_]*", stem):
        findings.append(f"{relative}: Python modules require snake_case (dunder names allowed)")
    if (path.suffix in {".tsx", ".jsx"} and "components" in Path(relative).parts
            and not stem.endswith((".test", ".spec"))
            and not re.fullmatch(r"[A-Z][A-Za-z0-9]*", stem)):
        findings.append(f"{relative}: React components require PascalCase")
    return findings


def inspect(root: Path, exceptions: dict) -> tuple[list[str], list[str]]:
    """Return failures and warnings without changing source files."""
    failures, warnings = [], []
    for folder in ("bot/app", "frontend/src", "scripts"):
        for path in (root / folder).rglob("*"):
            if not path.is_file() or path.suffix not in LIMITS:
                continue
            relative = path.relative_to(root).as_posix()
            failures.extend(name_findings(path, relative))
            lines = len(path.read_text(encoding="utf-8-sig").splitlines())
            if lines <= LIMITS[path.suffix]:
                continue
            exception = exceptions.get(relative, {})
            if exception.get("reason") and lines <= exception.get("max_lines", 0):
                warnings.append(f"{relative}: {lines} lines; {exception['reason']}")
            else:
                failures.append(f"{relative}: {lines} lines exceeds {LIMITS[path.suffix]}; review feature boundaries or document bounded exception")
    return failures, warnings


def main() -> int:
    """Load reviewed exceptions and return a deterministic gate result."""
    path = ROOT / "docs/workflow/structure-exceptions.json"
    exceptions = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    failures, warnings = inspect(ROOT, exceptions)
    for message in warnings:
        print("WARN", message)
    for message in failures:
        print("FAIL", message)
    print(f"Structure: {len(failures)} failures, {len(warnings)} reviewed exceptions")
    return int(bool(failures))


if __name__ == "__main__":
    raise SystemExit(main())
