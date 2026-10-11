#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
VENV="$REPO_ROOT/.venv-signbridge"

if ! command -v python3.12 >/dev/null 2>&1; then
  echo "Python 3.12 is required. Install it, then rerun this script." >&2
  exit 1
fi

if [[ -x "$VENV/bin/python" ]]; then
  if ! "$VENV/bin/python" -c 'import sys; raise SystemExit(sys.version_info[:2] != (3, 12))'; then
    echo "$VENV already exists but is not a Python 3.12 environment; remove it and rerun this script." >&2
    exit 1
  fi
else
  python3.12 -m venv "$VENV"
fi
"$VENV/bin/python" -m pip install --upgrade pip
"$VENV/bin/python" -m pip install -r "$SCRIPT_DIR/requirements.txt"
"$VENV/bin/python" "$SCRIPT_DIR/download_landmark_model.py"

echo
echo "ASL Assistant setup is complete."
echo "Check the model installation with:"
echo "  \"$VENV/bin/python\" \"$SCRIPT_DIR/check_environment.py\""
echo "Start the model service with:"
echo "  \"$VENV/bin/python\" \"$SCRIPT_DIR/service.py\""
echo "Then start ProveIt in another terminal with: pnpm dev"
