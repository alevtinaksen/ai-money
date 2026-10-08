"""Build and launch a synthetic stand with its own loopback API and database."""
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "preview/server.py"
PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def api_environment(port: int, stand_port: int) -> dict[str, str]:
    """Explicit overrides prevent .env credentials or real financial DB reuse."""
    database = ROOT / "work/design-stand/finance.db"
    database.parent.mkdir(parents=True, exist_ok=True)
    return {**os.environ, "HOST": "127.0.0.1", "PORT": str(port), "APP_ENV": "development",
            "DEBUG": "false", "ALLOW_LOCAL_LOGIN": "true", "TELEGRAM_MODE": "disabled", "WEB_CONCURRENCY": "1",
            "BOT_TOKEN": "", "GROQ_API_KEY": "", "GEMINI_API_KEY": "", "AI_PROVIDER": "disabled",
            "AI_UPLOAD_CONSENT": "false", "DATABASE_URL": f"sqlite+aiosqlite:///{database}",
            "DATABASE_SCHEMA": "", "DATABASE_SSL_CA_FILE": "",
            "WEBAPP_URL": f"http://127.0.0.1:{stand_port}", "SERVER_URL": ""}


def ensure_port_available(port: int) -> None:
    with socket.socket() as check:
        check.bind(("127.0.0.1", port))


def wait_ready(process: subprocess.Popen, origin: str) -> None:
    until = time.monotonic() + 20
    while time.monotonic() < until and process.poll() is None:
        try:
            with urllib.request.urlopen(origin + "/health/ready", timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(.1)
    raise RuntimeError("Local API did not become ready; see startup diagnostics")


def main() -> int:
    processes = []
    try:
        port = int(os.environ.get("PREVIEW_PORT", 8766))
        api_port = int(os.environ.get("PREVIEW_API_PORT", 8011))
        ensure_port_available(port)
        ensure_port_available(api_port)
        if not PYTHON.is_file():
            raise RuntimeError("Run python3 scripts/project.py setup first")
        npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
        if not npm or subprocess.run([npm, "run", "build"], cwd=ROOT / "frontend").returncode:
            raise RuntimeError("Frontend build failed; stand was not started")
        origin = f"http://127.0.0.1:{api_port}"
        api = subprocess.Popen([str(PYTHON), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(api_port), "--workers", "1"],
                               cwd=ROOT / "bot", env=api_environment(api_port, port))
        processes.append(api)
        wait_ready(api, origin)
        environment = {**os.environ, "PREVIEW_PORT": str(port), "PREVIEW_API_TARGET": origin}
        stand = subprocess.Popen([str(PYTHON), str(SERVER)], cwd=ROOT, env=environment)
        processes.append(stand)
        url = f"http://127.0.0.1:{port}/preview/index.html"
        print(f"Synthetic AI Money stand: {url}\nSeparate test DB: work/design-stand/finance.db", flush=True)
        if os.environ.get("PREVIEW_OPEN_BROWSER", "true").lower() != "false":
            webbrowser.open(url)
        while all(process.poll() is None for process in processes):
            time.sleep(.25)
        raise RuntimeError("A stand process stopped; both services are being shut down")
    except KeyboardInterrupt:
        return 0
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"Stand not running: {exc}", file=sys.stderr)
        return 1
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                process.terminate()
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()

if __name__ == "__main__":
    raise SystemExit(main())
