#!/usr/bin/env python3
"""Download and verify the hand landmark models used by the SignBridge demo."""

import hashlib
import os
import ssl
import tempfile
import urllib.request
from pathlib import Path

import certifi

MODEL_REVISION = "aaf4b9fba5de70827c20c74ca8d213833479d30c"
MODEL_REPO = "LucasLooTan/signbridge-asl-classifier"
FILES = {
    "asl_landmark_mlp.pt": "ad353ef31f7d73618e164bf9083fd9ff2f0fec69268224d5d903db85664a5d1e",
    "hand_landmarker.task": "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1",
}


def download_verified(filename: str, expected_sha256: str, destination: Path) -> None:
    url = f"https://huggingface.co/{MODEL_REPO}/resolve/{MODEL_REVISION}/{filename}"
    context = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(url, timeout=60, context=context) as response:
        content = response.read()
    if hashlib.sha256(content).hexdigest() != expected_sha256:
        raise ValueError(f"Downloaded model checksum did not match for {filename}.")
    with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as temporary:
        temporary.write(content)
        temporary_path = Path(temporary.name)
    temporary_path.replace(destination)


def main() -> int:
    default_cache = Path.home() / ".cache" / "proveit" / "signbridge" / "landmark"
    cache = Path(os.getenv("SIGNBRIDGE_LANDMARK_CACHE", str(default_cache))).expanduser()
    cache.mkdir(parents=True, exist_ok=True)
    for filename, digest in FILES.items():
        destination = cache / filename
        if destination.is_file() and hashlib.sha256(destination.read_bytes()).hexdigest() == digest:
            print(f"Already downloaded and verified: {destination}")
            continue
        download_verified(filename, digest, destination)
        print(f"Downloaded and verified: {destination}")
    print("ASL hand-landmark classifier ready; live letters need 75% confidence over 4 stable frames.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
