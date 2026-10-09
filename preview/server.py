"""Loopback-only design stand: public assets and a bounded same-origin API proxy."""
import http.client
import ipaddress
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIST = ROOT / "frontend" / "dist"
PREVIEW_DIR = ROOT / "preview"
API_TARGET = os.environ.get("PREVIEW_API_TARGET", "http://127.0.0.1:8000")
MAX_BYTES = 5 * 1024 * 1024 + 65536
PUBLIC_SUFFIXES = {".js", ".css", ".svg", ".woff", ".woff2", ".png", ".jpg", ".jpeg", ".webp", ".ico", ".txt"}


def loopback_target(value):
    """The proxy must never send credentials to a configurable remote service."""
    parsed = urlsplit(value)
    try:
        loopback = parsed.hostname == "localhost" or ipaddress.ip_address(parsed.hostname).is_loopback
    except ValueError:
        loopback = False
    if (parsed.scheme != "http" or not loopback or parsed.username or parsed.password
            or parsed.path not in {"", "/"} or parsed.query or parsed.fragment):
        raise ValueError("PREVIEW_API_TARGET must be a loopback HTTP origin")
    return parsed.hostname, parsed.port or 80


class Handler(BaseHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        root = Path(directory) if directory else ROOT
        self.dist = (root / "frontend/dist").resolve()
        self.preview = (root / "preview").resolve()
        super().__init__(*args, **kwargs)

    def log_message(self, *_):
        pass  # Never log bearer headers, bank rows, or arbitrary request targets.

    def respond(self, status, data, content_type="text/plain; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def permitted(self):
        expected = {"127.0.0.1", "localhost", "::1"}
        try:
            host = urlsplit("http://" + self.headers.get("Host", ""))
            origin = urlsplit(self.headers.get("Origin", ""))
            allowed = host.hostname in expected and host.port == self.server.server_port
            if "Origin" in self.headers:
                allowed = allowed and origin.scheme == "http" and origin.hostname in expected and origin.port == self.server.server_port
        except ValueError:
            allowed = False
        if not allowed:
            self.respond(403, b"Local stand origin required")
        return allowed

    def request_path(self):
        if not self.path.startswith("/") or self.path.startswith("//"):
            raise ValueError("Invalid request target")
        path = unquote(urlsplit(self.path).path)
        if "\x00" in path or "\\" in path or any(part.startswith(".") for part in path.split("/") if part):
            raise ValueError("Invalid path")
        return path

    def public_file(self, path):
        exact = {"/": (self.preview, "index.html"), "/preview/index.html": (self.preview, "index.html"),
                 "/app": (self.dist, "index.html"), "/app/": (self.dist, "index.html"),
                 "/frontend/dist/index.html": (self.dist, "index.html")}
        if path in exact:
            root, relative = exact[path]
        else:
            relative = path.removeprefix("/frontend/dist")
            if not any(relative.startswith(f"/{folder}/") for folder in ("assets", "fonts", "design")):
                return None
            root, relative = self.dist, relative.lstrip("/")
            if Path(relative).suffix.lower() not in PUBLIC_SUFFIXES:
                return None
        resolved = (root / relative).resolve()
        return resolved if resolved.is_relative_to(root) and resolved.is_file() else None

    def proxy(self):
        if self.headers.get("Transfer-Encoding"):
            self.respond(400, b"Content-Length required")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.respond(400, b"Invalid Content-Length")
            return
        if not 0 <= length <= MAX_BYTES:
            self.respond(413, b"Request too large")
            return
        connection = None
        try:
            host, port = loopback_target(API_TARGET)
            connection = http.client.HTTPConnection(host, port, timeout=50)
            body = self.rfile.read(length)
            headers = {name: self.headers[name] for name in ("Authorization", "Content-Type", "Origin") if name in self.headers}
            connection.request(self.command, self.path, body=body, headers=headers)
            upstream = connection.getresponse()
            payload = upstream.read(MAX_BYTES + 1)
            if len(payload) > MAX_BYTES:
                self.respond(502, b"Upstream response too large")
                return
            self.respond(upstream.status, payload, upstream.getheader("Content-Type", "application/json"))
        except (OSError, http.client.HTTPException, ValueError):
            self.respond(502, b'{"detail":"Local API unavailable; start scripts/preview.py"}', "application/problem+json")
        finally:
            if connection:
                connection.close()

    def handle_request(self):
        if not self.permitted():
            return
        try:
            path = self.request_path()
        except ValueError:
            self.respond(400, b"Invalid path")
            return
        if path.startswith("/api/"):
            self.proxy()
            return
        if self.command not in {"GET", "HEAD"}:
            self.respond(405, b"Method not allowed")
            return
        file = self.public_file(path)
        if file is None:
            self.respond(404, b"Not found")
            return
        try:
            self.respond(200, file.read_bytes(), mimetypes.guess_type(str(file))[0] or "application/octet-stream")
        except OSError:
            self.respond(404, b"Not found")

    do_GET = do_HEAD = do_POST = do_PUT = do_PATCH = do_DELETE = handle_request


if __name__ == "__main__":
    loopback_target(API_TARGET)
    port = int(os.environ.get("PREVIEW_PORT", 8766))
    print(f"AI Money local stand: http://127.0.0.1:{port}/preview/index.html", flush=True)
    with ThreadingHTTPServer(("127.0.0.1", port), Handler) as server:
        server.serve_forever()
