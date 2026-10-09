#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "=========================================================="
echo "💎 AI Money Design Testbench & Bot Simulator"
echo "Local synthetic stand, separate test database"
echo "=========================================================="
if [ ! -x .venv/bin/python ]; then
  echo "First run: python3 scripts/project.py setup"
  exit 1
fi
exec .venv/bin/python scripts/preview.py
