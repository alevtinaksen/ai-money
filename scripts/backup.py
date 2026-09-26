"""Consistent SQLite backup and non-overwriting restore, without loading credentials."""
from __future__ import annotations

import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import time


def sha256(path: Path) -> str:
    """Hash the file without holding the database in memory."""
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def readonly(path: Path) -> sqlite3.Connection:
    """Open an existing database with SQLite read-only mode, preserving WAL access."""
    return sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=10)


def integrity(connection: sqlite3.Connection) -> None:
    """Refuse databases that do not pass the full SQLite integrity check."""
    if connection.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
        raise ValueError("SQLite integrity check failed")


def copy_database(source: Path, destination: Path) -> None:
    """Create a new consistent snapshot, including committed WAL transactions."""
    if not source.is_file():
        raise ValueError("Source database does not exist")
    if source.resolve() == destination.resolve():
        raise ValueError("Source and destination must differ")
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    os.close(descriptor)
    deadline = time.monotonic() + 60

    def progress(status: int, remaining: int, total: int) -> None:
        if time.monotonic() > deadline:
            raise TimeoutError("Database stayed busy; retry during a quiet period")

    try:
        with closing(readonly(source)) as origin:
            with closing(sqlite3.connect(destination)) as target:
                origin.backup(target, pages=256, progress=progress, sleep=0.05)
                integrity(target)
    except Exception:
        destination.unlink(missing_ok=True)  # Only the file exclusively created above.
        raise


def backup(source: Path, destination: Path) -> Path:
    """Create a database snapshot and a metadata-only SHA-256 manifest."""
    manifest = destination.with_name(destination.name + ".manifest.json")
    if manifest.exists():
        raise FileExistsError("Manifest already exists; choose a new backup name")
    copy_database(source, destination)
    metadata = {"format": 1, "created_utc_epoch": time.time(), "sha256": sha256(destination),
                "bytes": destination.stat().st_size, "integrity_check": "ok"}
    descriptor = os.open(manifest, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        json.dump(metadata, stream, indent=2)
        stream.write("\n")
    return manifest


def restore(source: Path, destination: Path) -> None:
    """Verify a backup then restore to a new file; never switch the active database."""
    manifest = source.with_name(source.name + ".manifest.json")
    metadata = json.loads(manifest.read_text(encoding="utf-8"))
    if (not isinstance(metadata, dict) or metadata.get("format") != 1
            or metadata.get("sha256") != sha256(source)
            or metadata.get("bytes") != source.stat().st_size):
        raise ValueError("Backup manifest or checksum mismatch")
    with closing(readonly(source)) as connection:
        integrity(connection)
    copy_database(source, destination)


def main() -> int:
    """Run an explicitly selected backup or restore operation."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["backup", "restore"])
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    try:
        if args.operation == "backup":
            manifest = backup(args.source, args.destination)
            print(f"Backup verified; manifest: {manifest}")
        else:
            restore(args.source, args.destination)
            url = "sqlite+aiosqlite:///" + args.destination.resolve().as_posix()
            print("Restored to a NEW file; active database unchanged.")
            print("Stop API and bot, reconcile data, then explicitly change bot/.env:")
            print(f"DATABASE_URL={url}")
    except (OSError, ValueError, sqlite3.Error, TimeoutError) as exc:
        print(f"FAIL: {type(exc).__name__}. Check paths, manifest and database integrity.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
