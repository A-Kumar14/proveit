#!/usr/bin/env python3
"""Download the small MIT-licensed ASL alphabet demo model to the user cache."""

import hashlib
import os
import ssl
import tempfile
import urllib.request
from pathlib import Path

import certifi

MODEL_URL = "https://huggingface.co/satvik4577/asl-alphabet-tinycnn-int8/resolve/main/asl_int8.tflite"
LABELS_URL = "https://huggingface.co/satvik4577/asl-alphabet-tinycnn-int8/resolve/main/labels.txt"
FILES = {
    "asl_int8.tflite": (
        MODEL_URL,
        "416f709b3c5f56bdbcaf3758a51fa777ceb35ebf6799c6b970d34425542ea6ee",
    ),
    "labels.txt": (
        LABELS_URL,
        "c221268b6d241f401b82aa4cce430055c260772e241af4f1090d0add89ef3a35",
    ),
}


def download(url: str, expected_sha256: str, destination: Path) -> None:
    context = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(url, timeout=30, context=context) as response:
        content = response.read()
    digest = hashlib.sha256(content).hexdigest()
    if digest != expected_sha256:
        raise ValueError(f"Downloaded asset checksum did not match for {destination.name}.")
    with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as temporary:
        temporary.write(content)
        temporary_path = Path(temporary.name)
    temporary_path.replace(destination)


def main() -> int:
    cache = Path(os.getenv("SIGNBRIDGE_ASL_CACHE", Path.home() / ".cache" / "proveit" / "signbridge")).expanduser()
    cache.mkdir(parents=True, exist_ok=True)
    for filename, (url, digest) in FILES.items():
        destination = cache / filename
        if destination.is_file() and hashlib.sha256(destination.read_bytes()).hexdigest() == digest:
            print(f"Already downloaded and verified: {destination}")
            continue
        download(url, digest, destination)
        print(f"Downloaded and verified: {destination}")
    print("Model: satvik4577/asl-alphabet-tinycnn-int8 (MIT license)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
