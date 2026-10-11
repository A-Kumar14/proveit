#!/usr/bin/env python3
"""Convenience entry point for the local SignBridge model service."""

import sys
from pathlib import Path


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(repo_root))
    from signbridge_service.server import main

    raise SystemExit(main())
