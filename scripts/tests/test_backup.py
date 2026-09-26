"""Backup tests with synthetic balances, WAL commits and refused overwrites."""
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import backup


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "live.db"
        self.snapshot = self.root / "snapshot.db"
        self.connection = sqlite3.connect(self.source)
        self.addCleanup(self.connection.close)
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("CREATE TABLE money (amount INTEGER)")
        self.connection.execute("INSERT INTO money VALUES (12345)")
        self.connection.commit()

    def test_committed_wal_survives_backup_restore(self):
        self.assertTrue(Path(str(self.source) + "-wal").exists())
        manifest = backup.backup(self.source, self.snapshot)
        self.assertEqual(json.loads(manifest.read_text())["sha256"], backup.sha256(self.snapshot))
        restored = self.root / "restored.db"
        backup.restore(self.snapshot, restored)
        with closing(sqlite3.connect(restored)) as connection:
            self.assertEqual(connection.execute("SELECT amount FROM money").fetchall(), [(12345,)])

    def test_restore_refuses_existing_live_database(self):
        backup.backup(self.source, self.snapshot)
        with self.assertRaises(FileExistsError):
            backup.restore(self.snapshot, self.source)
        self.assertEqual(self.connection.execute("SELECT amount FROM money").fetchone(), (12345,))

    def test_tampered_backup_is_rejected_without_output(self):
        backup.backup(self.source, self.snapshot)
        with self.snapshot.open("ab") as stream:
            stream.write(b"tamper")
        restored = self.root / "restored.db"
        with self.assertRaises(ValueError):
            backup.restore(self.snapshot, restored)
        self.assertFalse(restored.exists())

    def test_missing_source_does_not_create_empty_backup(self):
        with self.assertRaises(ValueError):
            backup.backup(self.root / "absent.db", self.snapshot)
        self.assertFalse(self.snapshot.exists())

    def test_backup_refuses_existing_destination(self):
        self.snapshot.write_bytes(b"keep")
        with self.assertRaises(FileExistsError):
            backup.backup(self.source, self.snapshot)
        self.assertEqual(self.snapshot.read_bytes(), b"keep")
