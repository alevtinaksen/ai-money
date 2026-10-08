"""The local stand serves public artifacts and forwards only its loopback API."""
import functools
import importlib.util
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch
import urllib.error
import urllib.request

SPEC = importlib.util.spec_from_file_location(
    "preview_server", Path(__file__).resolve().parents[2] / "preview/server.py"
)
preview = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(preview)


class PreviewServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "project"
        for directory in ["bot", "preview", "frontend/dist/assets", "frontend/dist/fonts", "frontend/dist/design"]:
            (self.root / directory).mkdir(parents=True, exist_ok=True)
        for filename, data in {
            "bot/.env": b"SYNTHETIC_SECRET_SENTINEL",
            "preview/server.py": b"private_source",
            "preview/index.html": b"stand",
            "frontend/dist/index.html": b"app",
            "frontend/dist/assets/app.js": b"public_js",
            "frontend/dist/fonts/font.woff2": b"public_font",
            "frontend/dist/design/plus.svg": b"public_icon",
        }.items():
            (self.root / filename).write_bytes(data)
        outside = self.root.parent / "outside.txt"
        outside.write_text("SYNTHETIC_OUTSIDE_SENTINEL")
        (self.root / "frontend/dist/assets/leak.txt").symlink_to(outside)
        for name, value in {"ROOT": self.root, "FRONTEND_DIST": self.root / "frontend/dist", "PREVIEW_DIR": self.root / "preview"}.items():
            patcher = patch.object(preview, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(preview.Handler, directory=str(self.root)))
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def request(self, path, *, data=None, headers=None):
        request = urllib.request.Request(self.base + path, data=data, headers=headers or {})
        try:
            with urllib.request.urlopen(request, timeout=2) as response:
                return response.status, response.read(), response.headers
        except urllib.error.HTTPError as response:
            return response.code, response.read(), response.headers

    def test_private_files_and_directory_listing_are_never_served(self):
        for path in ["/bot/.env", "/bot/", "/preview/server.py", "/.git/config", "/frontend/dist/"]:
            with self.subTest(path=path):
                status, body, _ = self.request(path)
                self.assertIn(status, [400, 403, 404])
                self.assertNotIn(b"SYNTHETIC_SECRET", body)

    def test_plain_encoded_and_symlink_escape_are_rejected(self):
        for path in ["/preview/../../outside.txt", "/assets/../../../bot/.env", "/assets/%2e%2e/%2e%2e/%2e%2e/bot/.env", "/assets/leak.txt"]:
            with self.subTest(path=path):
                status, body, _ = self.request(path)
                self.assertIn(status, [400, 403, 404])
                self.assertNotIn(b"SYNTHETIC_", body)

    def test_complete_public_resources_and_aliases(self):
        for path, expected in {
            "/": b"stand", "/preview/index.html": b"stand",
            "/app/": b"app", "/frontend/dist/index.html": b"app",
            "/assets/app.js": b"public_js", "/fonts/font.woff2": b"public_font",
            "/design/plus.svg": b"public_icon",
        }.items():
            with self.subTest(path=path):
                status, body, headers = self.request(path)
                self.assertEqual((status, body), (200, expected))
                self.assertIsNone(headers.get("Access-Control-Allow-Origin"))

    def test_foreign_origin_and_rebinding_host_rejected(self):
        for headers in [{"Origin": "https://foreign.example"}, {"Origin": "null"}, {"Host": "foreign.example"}]:
            self.assertEqual(self.request("/assets/app.js", headers=headers)[0], 403)

    def test_api_proxy_preserves_method_body_auth_and_status(self):
        received = []

        class API(BaseHTTPRequestHandler):
            def do_POST(self):
                received.append((self.path, self.headers.get("Authorization"), self.rfile.read(int(self.headers.get("Content-Length", 0)))))
                self.send_response(422)
                self.send_header("Content-Type", "application/problem+json")
                self.end_headers()
                self.wfile.write(b'{"detail":"synthetic validation"}')

            def log_message(self, *_):
                pass

        api = ThreadingHTTPServer(("127.0.0.1", 0), API)
        threading.Thread(target=api.serve_forever, daemon=True).start()
        self.addCleanup(api.server_close)
        self.addCleanup(api.shutdown)
        with patch.object(preview, "API_TARGET", f"http://127.0.0.1:{api.server_port}", create=True):
            status, body, _ = self.request("/api/transactions", data=b'{"amount":"10"}', headers={"Authorization": "Bearer synthetic"})
        self.assertEqual(status, 422)
        self.assertIn(b"synthetic validation", body)
        self.assertEqual(received, [("/api/transactions", "Bearer synthetic", b'{"amount":"10"}')])

    def test_proxy_can_never_forward_credentials_to_remote_target(self):
        for target in ["https://127.0.0.1:8000", "http://foreign.example:8000", "http://127.0.0.1:8000/path", "http://user:pass@127.0.0.1:8000"]:
            with self.subTest(target=target), self.assertRaises(ValueError):
                preview.loopback_target(target)


if __name__ == "__main__":
    unittest.main()
