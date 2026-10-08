"""Stand startup isolation must not reuse credentials or the real ledger."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("preview_launcher", Path(__file__).resolve().parents[1] / "preview.py")
launcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(launcher)


class PreviewLauncherTests(unittest.TestCase):
    def test_startup_isolates_credentials_updates_and_database(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(launcher, "ROOT", Path(folder)), patch.dict(os.environ, {
            "BOT_TOKEN": "synthetic-private-token", "GEMINI_API_KEY": "synthetic-private-key", "GROQ_API_KEY": "synthetic-private-key",
            "DATABASE_URL": "sqlite+aiosqlite:///real-private-ledger.db", "DATABASE_SCHEMA": "private_production", "DATABASE_SSL_CA_FILE": "/private/ca.crt", "AI_UPLOAD_CONSENT": "true", "TELEGRAM_MODE": "webhook", "WEB_CONCURRENCY": "2",
        }):
            env = launcher.api_environment(8011, 8766)
            self.assertEqual(env["BOT_TOKEN"], "")
            self.assertEqual(env["GEMINI_API_KEY"], "")
            self.assertEqual(env["GROQ_API_KEY"], "")
            self.assertEqual(env["TELEGRAM_MODE"], "disabled")
            self.assertEqual(env["AI_PROVIDER"], "disabled")
            self.assertEqual(env["AI_UPLOAD_CONSENT"], "false")
            self.assertEqual(env["WEB_CONCURRENCY"], "1")
            self.assertEqual(env["DATABASE_SCHEMA"], "")
            self.assertEqual(env["DATABASE_SSL_CA_FILE"], "")
            self.assertTrue(env["DATABASE_URL"].endswith("work/design-stand/finance.db"))
            self.assertNotIn("real-private", env["DATABASE_URL"])
            self.assertEqual(env["WEBAPP_URL"], "http://127.0.0.1:8766")
            self.assertEqual(os.environ["BOT_TOKEN"], "synthetic-private-token")


if __name__ == "__main__":
    unittest.main()
