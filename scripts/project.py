"""Project-local setup, diagnostics and quality commands (no global configuration)."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
VENV_PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def run(args: list[str], cwd: Path = ROOT, env: dict[str, str] | None = None) -> bool:
    """Run one command without shell expansion and return real exit status."""
    print("Running:", " ".join(args), flush=True)
    try:
        return subprocess.run(args, cwd=cwd, env=env, check=False).returncode == 0
    except OSError as exc:
        print(f"FAIL: {exc}")
        return False


def npm() -> str:
    """Locate npm without assuming a Unix executable suffix."""
    return shutil.which("npm.cmd" if os.name == "nt" else "npm") or "npm"


def fingerprint() -> str:
    """Hash code, tests, lockfiles and quality configuration for freshness checks."""
    digest = hashlib.sha256()
    ignored = {".git", ".venv", "node_modules", "dist", "__pycache__", ".pytest_cache",
               ".ruff_cache", ".mypy_cache", "htmlcov", "work", "backups"}
    for path in sorted(ROOT.rglob("*")):
        rel = path.relative_to(ROOT)
        if rel.parts[:2] == ("docs", "release"):
            continue  # Generated verification evidence is not executable source.
        if not path.is_file() or set(rel.parts) & ignored:
            continue
        if (path.name in {".env", ".DS_Store", ".coverage"} or path.name.endswith("~")
                or path.suffix in {".db", ".db-wal", ".db-shm", ".pyc", ".tsbuildinfo", ".swp", ".swo"}):
            continue
        digest.update(rel.as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def doctor() -> bool:
    """Inspect requirements; never install or display environment secrets."""
    checks = {
        "Python 3.12+": sys.version_info >= (3, 12),
        "Node executable": bool(shutil.which("node")),
        "npm executable": bool(shutil.which("npm.cmd" if os.name == "nt" else "npm")),
        "Python virtual environment": VENV_PYTHON.exists(),
        "Local environment": (ROOT / "bot/.env").exists(),
        "Frontend packages": (ROOT / "frontend/node_modules").is_dir(),
    }
    if shutil.which("node"):
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        try:
            checks["Node 22+"] = int(result.stdout.strip().lstrip("v").split(".")[0]) >= 22
        except ValueError:
            checks["Node 22+"] = False
    for label, ok in checks.items():
        print(f"{'PASS' if ok else 'MISSING'} {label}")
    print("UNVERIFIED: Antigravity IDE discovery, hook activation and macOS runtime.")
    return all(checks.values())


def setup() -> bool:
    """Create local dependencies and preserve existing environment files."""
    if sys.version_info < (3, 12):
        print("Install Python 3.12+ and rerun with that interpreter.")
        return False
    if not shutil.which("node") or not shutil.which("npm.cmd" if os.name == "nt" else "npm"):
        print("Install Node.js 22 LTS or newer first.")
        return False
    version = subprocess.run(["node", "--version"], capture_output=True, text=True)
    if version.returncode or int(version.stdout.strip().lstrip("v").split(".")[0]) < 22:
        print("Node.js 22+ is required.")
        return False
    if not VENV_PYTHON.exists() and not run([sys.executable, "-m", "venv", str(ROOT / ".venv")]):
        return False
    if not run([str(VENV_PYTHON), "-m", "pip", "install", "-r", "bot/requirements.txt"]):
        return False
    if not run([npm(), "ci"], ROOT / "frontend"):
        return False
    for folder in (ROOT / "bot", ROOT / "frontend"):
        target = folder / ".env"
        template = folder / ".env.example"
        if not target.exists() and template.exists():
            shutil.copyfile(template, target)
    configure_hooks()
    return doctor()


def configure_hooks() -> None:
    """Merge only our named hook, preserving all unrelated hook definitions."""
    import shlex
    target = ROOT / ".agents/hooks.json"
    payload = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {}
    command = shlex.join([str(VENV_PYTHON), str(ROOT / "scripts/antigravity_hook.py")])
    payload["ai-money-evidence"] = {"enabled": True, "PreInvocation": [
        {"type": "command", "command": command, "timeout": 10}
    ]}
    target.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if target.exists() and target.read_text(encoding="utf-8") != content:
        backup = ROOT / "work/setup-backups" / f"hooks-{time.time_ns()}.json"
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(target, backup)
    target.write_text(content, encoding="utf-8")


def quality() -> bool:
    """Execute all gates, save exact statuses; absent tools are failures."""
    interpreter = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable
    environment = dict(os.environ)
    environment.update({"PYTHONPATH": str(ROOT / "bot"), "BOT_TOKEN": "", "ALLOW_LOCAL_LOGIN": "false"})
    before = fingerprint()
    commands = [
        ("lint", [interpreter, "-m", "ruff", "check", "bot/app", "bot/tests", "scripts"], ROOT),
        ("toolkit", [interpreter, "-m", "unittest", "discover", "-s", "scripts/tests", "-v"], ROOT),
        ("structure", [interpreter, "scripts/structure_check.py"], ROOT),
        ("frontend-tests", [npm(), "test"], ROOT / "frontend"),
        ("frontend-build", [npm(), "run", "build"], ROOT / "frontend"),
    ]
    checks = {name: run(command, cwd, environment) for name, command, cwd in commands}
    checks["source-stable"] = before == fingerprint()
    report = {"created": time.time(), "fingerprint": fingerprint(), "checks": checks,
              "passed": all(checks.values()), "mac_ide_verified": False}
    target = ROOT / "work/quality/latest.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("QUALITY:", "PASS" if report["passed"] else "FAIL", checks)
    return bool(report["passed"])


def preflight() -> bool:
    """Fail closed without recent passing gates for identical project contents."""
    path = ROOT / "work/quality/latest.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        required = {"lint", "toolkit", "structure", "backend", "frontend-tests", "frontend-build", "source-stable"}
        ok = (data.get("passed") is True and required <= data.get("checks", {}).keys()
              and all(data["checks"][key] is True for key in required)
              and data.get("fingerprint") == fingerprint()
              and 0 <= time.time() - data.get("created", 0) <= 86400)
    except (OSError, ValueError, TypeError, KeyError):
        ok = False
    print("PREFLIGHT:", "PASS (local gates only; no deployment performed)" if ok else "FAIL: rerun quality")
    return ok


def serve(surface: str) -> bool:
    """Start an explicitly local development service in this terminal."""
    if surface == "frontend":
        return run([npm(), "run", "dev", "--", "--host", "127.0.0.1"], ROOT / "frontend")
    if not VENV_PYTHON.exists():
        print("Run setup first.")
        return False
    if surface == "bot":
        return run([str(VENV_PYTHON), "-m", "app.bot.run"], ROOT / "bot")
    environment = dict(os.environ)
    environment.update({"HOST": "127.0.0.1", "BOT_TOKEN": "", "ALLOW_LOCAL_LOGIN": "true"})
    return run([str(VENV_PYTHON), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1",
                "--port", "8000", "--reload"], ROOT / "bot", environment)


def main() -> int:
    """Dispatch the novice-friendly command interface."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["setup", "doctor", "quality", "preflight", "backend", "frontend", "bot", "hooks"])
    args = parser.parse_args()
    if args.command == "hooks":
        configure_hooks()
        print("Hook file configured; live IDE execution remains unverified.")
        return 0
    if args.command in {"backend", "frontend", "bot"}:
        return 0 if serve(args.command) else 1
    return 0 if {"setup": setup, "doctor": doctor, "quality": quality, "preflight": preflight}[args.command]() else 1


if __name__ == "__main__":
    raise SystemExit(main())
