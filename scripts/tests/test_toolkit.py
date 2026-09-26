"""Regression tests for toolkit safety and freshness, using temporary projects."""
from __future__ import annotations

import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import antigravity_hook as hook
import project
import structure_check


class ToolkitTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_wrong_workspace_writes_nothing(self):
        self.assertEqual(hook.handle({"workspacePaths": ["/elsewhere"], "invocationNum": 0}, self.root), {})
        self.assertFalse((self.root / "work").exists())

    def test_synthetic_marker_cannot_be_mistaken_for_live(self):
        payload = {"workspacePaths": [str(self.root)], "invocationNum": 0, "secret": "do-not-record"}
        self.assertIn("injectSteps", hook.handle(payload, self.root, True))
        marker = self.root / "work/antigravity/synthetic-hook.json"
        self.assertNotIn("do-not-record", marker.read_text())
        self.assertFalse((marker.parent / "live-hook.json").exists())

    def test_invalid_invocation_is_ignored(self):
        self.assertEqual(hook.handle({"workspacePaths": [str(self.root)]}, self.root), {})

    def test_names_reject_duplicates_and_preserve_entrypoints(self):
        names = {
            "bot/app/BadName.py": True,
            "bot/app/__init__.py": False,
            "frontend/src/components/dashboard.tsx": True,
            "frontend/src/components/Dashboard.test.tsx": False,
            "frontend/src/components/Dashboard.tsx": False,
            "frontend/src/main.tsx": False,
            "frontend/src/money_final2.ts": True,
            "frontend/src/MoneyBackup.ts": True,
            "bot/app/finance_copy.py": True,
            "scripts/backup.py": False,
            "scripts/tests/test_backup.py": False,
        }
        for name, invalid in names.items():
            with self.subTest(name=name):
                self.assertEqual(bool(structure_check.name_findings(Path(name), name)), invalid)

    def test_hook_reports_oversize_without_rewriting_source(self):
        source = self.root / "bot/app/finance_final2.py"
        source.parent.mkdir(parents=True)
        original = "# Existing behavior\n" * 501
        source.write_text(original)
        output = hook.handle({"workspacePaths": [str(self.root)], "invocationNum": 1}, self.root, True)
        message = output["injectSteps"][0]["ephemeralMessage"]
        self.assertIn("501 lines", message)
        self.assertIn("source name", message)
        self.assertEqual(source.read_text(), original)
        files = {item.relative_to(self.root).as_posix() for item in self.root.rglob("*") if item.is_file()}
        self.assertEqual(files, {"bot/app/finance_final2.py", "work/antigravity/synthetic-hook.json"})

    def test_hook_reports_invalid_scan_as_unverified(self):
        config = self.root / "docs/workflow/structure-exceptions.json"
        config.parent.mkdir(parents=True)
        config.write_text("[]")
        self.assertIn("UNVERIFIED", hook.structure_message(self.root))

    def test_oversized_module_fails_and_bounded_exception_warns(self):
        path = self.root / "frontend/src/feature.ts"
        path.parent.mkdir(parents=True)
        path.write_text("line\n" * 301)
        errors, _ = structure_check.inspect(self.root, {})
        self.assertEqual(len(errors), 1)
        exception = {"frontend/src/feature.ts": {"max_lines": 301, "reason": "Legacy module awaiting behavior tests"}}
        errors, warnings = structure_check.inspect(self.root, exception)
        self.assertFalse(errors)
        self.assertEqual(len(warnings), 1)
        path.write_text("line\n" * 302)
        self.assertTrue(structure_check.inspect(self.root, exception)[0])

    def test_preflight_requires_all_checks_and_fresh_contents(self):
        with patch.object(project, "ROOT", self.root), contextlib.redirect_stdout(io.StringIO()):
            self.assertFalse(project.preflight())
            target = self.root / "work/quality/latest.json"
            target.parent.mkdir(parents=True)
            keys = ["lint", "toolkit", "structure", "backend", "frontend-tests", "frontend-build", "source-stable"]
            data = {"passed": True, "created": time.time(), "fingerprint": project.fingerprint(), "checks": dict.fromkeys(keys, True)}
            target.write_text(json.dumps(data))
            self.assertTrue(project.preflight())
            data["checks"].pop("lint")
            target.write_text(json.dumps(data))
            self.assertFalse(project.preflight())
            data["checks"]["lint"] = True
            data["checks"].pop("backend")
            target.write_text(json.dumps(data))
            self.assertFalse(project.preflight())
            data["checks"]["backend"] = True
            data["created"] = time.time() - 90000
            target.write_text(json.dumps(data))
            self.assertFalse(project.preflight())
            data["created"] = time.time()
            target.write_text(json.dumps(data))
            (self.root / "changed.py").write_text("changed")
            self.assertFalse(project.preflight())

    def test_hook_configuration_preserves_other_hooks(self):
        target = self.root / ".agents/hooks.json"
        target.parent.mkdir()
        target.write_text('{"another-hook": {"enabled": false}}')
        with patch.object(project, "ROOT", self.root):
            project.configure_hooks()
        data = json.loads(target.read_text())
        self.assertEqual(data["another-hook"], {"enabled": False})
        self.assertTrue(list((self.root / "work/setup-backups").iterdir()))

    def test_cache_does_not_change_fingerprint_but_tests_do(self):
        with patch.object(project, "ROOT", self.root):
            before = project.fingerprint()
            cache = self.root / ".ruff_cache/cache"
            cache.parent.mkdir()
            cache.write_text("generated")
            (self.root / ".DS_Store").write_text("finder")
            self.assertEqual(before, project.fingerprint())
            test = self.root / "test_money.py"
            test.write_text("assert True")
            self.assertNotEqual(before, project.fingerprint())


if __name__ == "__main__":
    unittest.main()
