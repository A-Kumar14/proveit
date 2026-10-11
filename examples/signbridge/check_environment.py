#!/usr/bin/env python3
"""Check the ASL Assistant runtime, model files, and a no-hand inference round trip."""

from __future__ import annotations

import platform
import sys
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))


def main() -> int:
    if sys.version_info[:2] != (3, 12):
        raise RuntimeError(
            f"The ASL Assistant's tested local environment uses Python 3.12; found {platform.python_version()}."
        )

    import cv2
    import mediapipe
    import numpy
    import torch

    from signbridge_service.server import SignBridgeEngine

    print(f"Platform: {platform.platform()} ({platform.machine()})")
    print(f"Python: {platform.python_version()}")
    print(f"MediaPipe: {mediapipe.__version__}")
    print(f"OpenCV: {cv2.__version__}")
    print(f"NumPy: {numpy.__version__}")
    print(f"PyTorch: {torch.__version__}")

    engine = SignBridgeEngine(None)
    try:
        if engine.mode != "SignBridge Hand Landmark MLP":
            raise RuntimeError(f"Unexpected model mode: {engine.mode}")
        ok, encoded = cv2.imencode(".jpg", numpy.zeros((240, 320, 3), dtype=numpy.uint8))
        if not ok:
            raise RuntimeError("Could not prepare the diagnostic camera frame.")
        result = engine.predict(str(uuid.uuid4()), encoded.tobytes())
        if result["handDetected"] or result["faceDetected"] or result["source"] != "none":
            raise RuntimeError(f"Blank-frame safety check failed: {result}")
        print("Model startup: ready")
        print("Blank-frame hand/face rejection: passed")
    finally:
        engine.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
