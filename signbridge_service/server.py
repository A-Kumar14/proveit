#!/usr/bin/env python3
"""Loopback HTTP adapter for the separate SignBridge-ML project."""

from __future__ import annotations

import base64
import binascii
import ipaddress
import json
import logging
import os
import sys
import threading
import time
import uuid
from collections import Counter, OrderedDict, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

MAX_FRAME_BYTES = 1_000_000
MAX_REQUEST_BYTES = 1_400_000
MAX_MOTION_REQUEST_BYTES = 4_000_000
MAX_MOTION_FRAMES = 12
MAX_SESSIONS = 8
SESSION_TTL_SECONDS = 30 * 60
LOGGER = logging.getLogger("signbridge.service")


def parse_session_id(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError("sessionId must be a UUID.")
    try:
        return str(uuid.UUID(value))
    except (ValueError, AttributeError) as error:
        raise ValueError("sessionId must be a UUID.") from error


def parse_prediction_request(body: bytes) -> tuple[str, bytes]:
    try:
        data = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Request body must be valid JSON.") from error
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object.")

    session_id = parse_session_id(data.get("sessionId"))
    image = data.get("image")
    if not isinstance(image, str) or not image:
        raise ValueError("image must contain a base64-encoded JPEG frame.")
    try:
        frame = base64.b64decode(image, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError("image must contain valid base64 data.") from error
    if not frame:
        raise ValueError("image must contain a non-empty frame.")
    if len(frame) > MAX_FRAME_BYTES:
        raise ValueError("Frame is too large.")
    return session_id, frame


def parse_reset_request(body: bytes) -> str:
    try:
        data = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Request body must be valid JSON.") from error
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object.")
    return parse_session_id(data.get("sessionId"))


def parse_motion_request(body: bytes) -> tuple[str, list[bytes]]:
    try:
        data = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Request body must be valid JSON.") from error
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object.")
    session_id = parse_session_id(data.get("sessionId"))
    images = data.get("frames")
    if not isinstance(images, list) or not 2 <= len(images) <= MAX_MOTION_FRAMES:
        raise ValueError(f"frames must contain between 2 and {MAX_MOTION_FRAMES} images.")
    frames: list[bytes] = []
    total = 0
    for image in images:
        if not isinstance(image, str) or not image:
            raise ValueError("Each frame must contain base64-encoded JPEG data.")
        try:
            frame = base64.b64decode(image, validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError("Each frame must contain valid base64 data.") from error
        if not frame or len(frame) > MAX_FRAME_BYTES:
            raise ValueError("Each motion frame must be non-empty and no larger than 1 MB.")
        total += len(frame)
        frames.append(frame)
    if total > MAX_MOTION_REQUEST_BYTES:
        raise ValueError("Motion frame sequence is too large.")
    return session_id, frames


class LandmarkASLClassifier:
    """Hand detection plus a trained landmark MLP; never predicts without a hand."""

    def __init__(self, model_path: Path, hand_model_path: Path):
        try:
            import cv2
            import mediapipe as mp
            import numpy as np
            import torch
            from mediapipe.tasks.python import BaseOptions, vision
        except ImportError as error:
            raise ImportError(
                "The landmark model needs mediapipe and torch. "
                "Install examples/signbridge/requirements.txt."
            ) from error

        torch.set_num_threads(1)
        checkpoint = torch.load(str(model_path), map_location="cpu", weights_only=True)
        input_size = int(checkpoint["n_in"])
        output_size = int(checkpoint["n_out"])
        if input_size != 63:
            raise ValueError(f"Landmark model expects {input_size} features; expected 63.")
        self.labels = checkpoint.get("classes")
        if (
            not isinstance(self.labels, list)
            or len(self.labels) != output_size
            or any(not isinstance(label, str) or not label for label in self.labels)
        ):
            raise ValueError("Landmark model checkpoint has invalid output labels.")

        class LandmarkMLP(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.net = torch.nn.Sequential(
                    torch.nn.Linear(input_size, 256),
                    torch.nn.GELU(),
                    torch.nn.Dropout(0.1),
                    torch.nn.Linear(256, 256),
                    torch.nn.GELU(),
                    torch.nn.Dropout(0.1),
                    torch.nn.Linear(256, 128),
                    torch.nn.GELU(),
                    torch.nn.Linear(128, output_size),
                )

            def forward(self, features):
                return self.net(features)

        self.classifier = LandmarkMLP()
        self.classifier.load_state_dict(checkpoint["model_state_dict"], strict=True)
        self.classifier.eval()
        options = vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(hand_model_path)),
            num_hands=1,
            min_hand_detection_confidence=0.3,
            min_hand_presence_confidence=0.3,
        )
        self.landmarker = vision.HandLandmarker.create_from_options(options)
        from mediapipe.python.solutions.face_mesh import FaceMesh

        self.face_mesh = FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=False,
            min_detection_confidence=0.5,
        )
        self.mp = mp
        self.cv2 = cv2
        self.np = np
        self.torch = torch
        self._lock = threading.Lock()

    @staticmethod
    def _face_features(landmarks: Any) -> tuple[list[list[float]], dict[str, float]]:
        indices = (10, 234, 152, 454, 105, 159, 334, 386, 13, 14, 61, 291)
        points = [[float(landmarks[index].x), float(landmarks[index].y)] for index in indices]

        mouth_width = max(abs(landmarks[78].x - landmarks[308].x), 1e-6)
        mouth_open = abs(landmarks[13].y - landmarks[14].y) / mouth_width
        left_eye_height = max(abs(landmarks[159].y - landmarks[145].y), 1e-6)
        right_eye_height = max(abs(landmarks[386].y - landmarks[374].y), 1e-6)
        brow_eye_gap = (
            abs(landmarks[159].y - landmarks[105].y) / left_eye_height
            + abs(landmarks[386].y - landmarks[334].y) / right_eye_height
        ) / 2
        return points, {
            "mouthOpen": min(float(mouth_open), 1.0),
            "browEyeGap": min(float(brow_eye_gap), 5.0),
        }

    @staticmethod
    def _orientation_features(coordinates: Any) -> Any | None:
        """Wrist-relative, scale-normalized landmarks as-is and mirrored left-right: a (2, 63) array.

        Some webcams mirror their feed and signers use either hand, both of which turn a handshape into its
        mirror image. Scoring both orientations gives the same letter on every camera and for either hand.
        Returns None when the hand is too small to normalize.
        """
        import numpy as np

        relative = np.asarray(coordinates, dtype=np.float32) - np.asarray(coordinates[0], dtype=np.float32)
        scale = float(np.linalg.norm(relative[9]))
        if scale <= 1e-6:
            return None
        normalized = relative / scale
        mirrored = normalized * np.array([-1.0, 1.0, 1.0], dtype=np.float32)
        return np.stack([normalized.reshape(-1), mirrored.reshape(-1)])

    def predict(self, frame: Any) -> tuple[
        str,
        float | None,
        bool,
        list[list[float]] | None,
        bool,
        list[list[float]] | None,
        dict[str, float] | None,
    ]:
        with self._lock:
            rgb = self.np.ascontiguousarray(frame)
            height, width = rgb.shape[:2]
            if max(height, width) > 480:
                scale = 480 / max(height, width)
                rgb = self.cv2.resize(
                    rgb,
                    (round(width * scale), round(height * scale)),
                    interpolation=self.cv2.INTER_AREA,
                )
            face_result = self.face_mesh.process(rgb)
            face_detected = bool(face_result.multi_face_landmarks)
            face_points = None
            facial_cues = None
            if face_detected:
                face_points, facial_cues = self._face_features(
                    face_result.multi_face_landmarks[0].landmark
                )
            result = self.landmarker.detect(
                self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=rgb)
            )
            if not result.hand_landmarks:
                return "No hand", None, False, None, face_detected, face_points, facial_cues

            coordinates = self.np.asarray(
                [[point.x, point.y, point.z] for point in result.hand_landmarks[0]],
                dtype=self.np.float32,
            )
            points = [[float(point.x), float(point.y)] for point in result.hand_landmarks[0]]
            orientations = self._orientation_features(coordinates)
            if orientations is None:
                return "Uncertain", 0.0, True, points, face_detected, face_points, facial_cues
            with self.torch.inference_mode():
                probabilities = self.torch.softmax(self.classifier(self.torch.from_numpy(orientations)), dim=1)
            # Keep whichever orientation the model reads most clearly.
            best_scores, best_labels = probabilities.max(dim=1)
            row = int(self.torch.argmax(best_scores).item())
            index = int(best_labels[row].item())
            confidence = float(best_scores[row].item())
            return self.labels[index], confidence, True, points, face_detected, face_points, facial_cues

    def close(self) -> None:
        self.landmarker.close()
        self.face_mesh.close()


class CameraSession:
    def __init__(self, detector: Any, smoothing_window: int, sequence_length: int):
        self.detector = detector
        self.recent_predictions = deque(maxlen=smoothing_window)
        self.sequence = deque(maxlen=sequence_length)
        self.last_used = time.monotonic()

    def close(self) -> None:
        self.detector.close()


class TinyASLClassifier:
    def __init__(self, model_path: Path):
        try:
            from ai_edge_litert.interpreter import Interpreter
            import cv2
            import numpy as np
        except ImportError as error:
            raise ImportError(
                "The ASL demo model needs ai-edge-litert, opencv-python-headless, and numpy. "
                "Install examples/signbridge/requirements-tinycnn.txt."
            ) from error

        labels_path = Path(os.getenv("SIGNBRIDGE_ASL_LABELS_PATH", str(model_path.with_name("labels.txt"))))
        if not labels_path.is_file():
            raise FileNotFoundError(f"ASL model labels not found at {labels_path}.")
        self.labels = [label.strip() for label in labels_path.read_text().splitlines() if label.strip()]
        self.interpreter = Interpreter(model_path=str(model_path), num_threads=2)
        self.interpreter.allocate_tensors()
        self.input = self.interpreter.get_input_details()[0]
        self.output = self.interpreter.get_output_details()[0]
        if len(self.labels) != int(self.output["shape"][-1]):
            raise ValueError("ASL model labels do not match the model output classes.")
        self.cv2 = cv2
        self.np = np

    def predict(self, frame: Any) -> tuple[str, float]:
        height, width = frame.shape[:2]
        side = min(height, width)
        top = (height - side) // 2
        left = (width - side) // 2
        crop = frame[top : top + side, left : left + side]
        image = self.cv2.cvtColor(crop, self.cv2.COLOR_BGR2GRAY)
        image = self.cv2.resize(image, (64, 64), interpolation=self.cv2.INTER_AREA)
        image = image.astype(self.np.float32) / 255.0

        scale, zero_point = self.input["quantization"]
        if scale > 0 and self.input["dtype"] in (self.np.int8, self.np.uint8):
            limits = self.np.iinfo(self.input["dtype"])
            image = self.np.clip(self.np.rint(image / scale + zero_point), limits.min, limits.max).astype(self.input["dtype"])
        else:
            image = image.astype(self.input["dtype"])
        self.interpreter.set_tensor(self.input["index"], image.reshape(self.input["shape"]))
        self.interpreter.invoke()
        scores = self.interpreter.get_tensor(self.output["index"])[0].astype(self.np.float32)
        output_scale, output_zero = self.output["quantization"]
        if output_scale > 0:
            scores = (scores - output_zero) * output_scale
        index = int(self.np.argmax(scores))
        return self.labels[index], float(scores[index])


class SignBridgeEngine:
    """Load models once and keep independent temporal state for each browser camera."""

    def __init__(self, project_dir: Path | None):
        model_path = os.getenv("SIGNBRIDGE_ASL_MODEL_PATH")
        model_file = Path(model_path).expanduser().resolve() if model_path else None
        if model_file is not None and not model_file.is_file():
            raise FileNotFoundError(f"ASL model not found at {model_file}.")
        default_landmark_cache = Path.home() / ".cache" / "proveit" / "signbridge" / "landmark"
        landmark_model_env = os.getenv("SIGNBRIDGE_LANDMARK_MLP_PATH")
        hand_model_env = os.getenv("SIGNBRIDGE_HAND_LANDMARKER_PATH")
        landmark_file = Path(landmark_model_env).expanduser().resolve() if landmark_model_env else default_landmark_cache / "asl_landmark_mlp.pt"
        hand_file = Path(hand_model_env).expanduser().resolve() if hand_model_env else default_landmark_cache / "hand_landmarker.task"
        landmark_configured = landmark_model_env is not None or hand_model_env is not None

        project = project_dir.expanduser().resolve() if project_dir else None
        if project and (project / "configs" / "config.yaml").is_file():
            sys.path.insert(0, str(project))
        else:
            project = None

        if project is None:
            if landmark_file.is_file() and hand_file.is_file():
                self._init_landmark_model(landmark_file, hand_file)
                return
            if landmark_configured:
                raise FileNotFoundError(
                    f"Landmark model files were not found at {landmark_file} and {hand_file}. "
                    "Run examples/signbridge/download_landmark_model.py first."
                )
            if model_file is None:
                raise FileNotFoundError(
                    "Run examples/signbridge/download_landmark_model.py for hand-aware ASL letters, "
                    "or set SIGNBRIDGE_ML_PATH to an upstream checkout with trained models. "
                    "The old image-only demo model is optional and can guess without hand detection."
                )
            self._init_tiny_model(model_file)
            return

        self.mode = "SignBridge-ML"
        self.tiny_classifier = None
        project_dir = project

        import cv2
        import numpy as np
        from src.inference.mediapipe_detector import HandDetector
        from src.inference.predict import (
            compute_motion_score,
            load_sequence_model,
            predict_gru_window,
            predict_sign,
            should_accept_gru_label,
        )
        from src.utils.utils import landmarks_to_feature_vector, load_config, load_model

        self._cv2 = cv2
        self._np = np
        self._hand_detector = HandDetector
        self._feature_vector = landmarks_to_feature_vector
        self._predict_sign = predict_sign
        self._predict_gru = predict_gru_window
        self._motion_score = compute_motion_score
        self._accept_motion = should_accept_gru_label

        self.config = load_config(str(project_dir / "configs" / "config.yaml"))
        static_dir = project_dir / self.config["paths"]["models_final"]
        static_path = static_dir / "model.joblib"
        if not static_path.is_file():
            if landmark_file.is_file() and hand_file.is_file():
                self._init_landmark_model(landmark_file, hand_file)
                return
            if model_file is not None:
                self._init_tiny_model(model_file)
                return
            raise FileNotFoundError(
                f"Static model not found at {static_path}. Train SignBridge-ML's static model first."
            )
        sequence_dir = project_dir / self.config["sequence_project"]["paths"]["models_final"]
        if not (sequence_dir / "sequence_model.pt").is_file() or not (sequence_dir / "sequence_model_meta.json").is_file():
            if landmark_file.is_file() and hand_file.is_file():
                self._init_landmark_model(landmark_file, hand_file)
                return
            if model_file is not None:
                self._init_tiny_model(model_file)
                return
        self.static_model = load_model(str(static_path))
        self.sequence_model, self.sequence_meta = load_sequence_model(str(sequence_dir))
        self.sequence_config = self.config["sequence_project"]
        self.sequence_length = int(self.sequence_config["sequence_length"])
        self.static_confidence = float(self.config.get("inference", {}).get("confidence_threshold", 0.6))
        self.sequence_confidence = float(self.sequence_config["inference"]["confidence_threshold"])
        self.motion_threshold = float(self.sequence_config["inference"].get("motion_threshold", 0.08))
        self.smoothing_window = int(self.config.get("inference", {}).get("smoothing_window", 5))

        detector_config = self.config["mediapipe"]
        self.detector_options = {
            "max_num_hands": detector_config["max_num_hands"],
            "min_detection_confidence": detector_config["min_detection_confidence"],
            "min_tracking_confidence": detector_config["min_tracking_confidence"],
            "static_image_mode": detector_config["static_image_mode"],
        }
        self._sessions: OrderedDict[str, CameraSession] = OrderedDict()
        self._lock = threading.RLock()

    def _init_landmark_model(self, model_file: Path, hand_file: Path) -> None:
        import cv2
        import numpy as np

        self.mode = "SignBridge Hand Landmark MLP"
        self._cv2 = cv2
        self._np = np
        self.landmark_classifier = LandmarkASLClassifier(model_file, hand_file)
        self.tiny_classifier = None
        self._sessions = OrderedDict()
        self._lock = threading.RLock()

    def _init_tiny_model(self, model_file: Path) -> None:
        try:
            import cv2
            import numpy as np
        except ImportError as error:
            raise ImportError(
                "The ASL demo model needs opencv-python-headless and numpy. "
                "Install examples/signbridge/requirements.txt."
            ) from error
        self._cv2 = cv2
        self._np = np
        self.mode = "ASL Alphabet TinyCNN"
        self.tiny_classifier = TinyASLClassifier(model_file)
        self._sessions: OrderedDict[str, CameraSession] = OrderedDict()
        self._lock = threading.RLock()

    def _new_session(self) -> CameraSession:
        return CameraSession(
            self._hand_detector(**self.detector_options),
            self.smoothing_window,
            self.sequence_length,
        )

    def _drop_session(self, session_id: str) -> None:
        session = self._sessions.pop(session_id, None)
        if session is not None:
            session.close()

    def _get_session(self, session_id: str) -> CameraSession:
        now = time.monotonic()
        for old_id, session in list(self._sessions.items()):
            if now - session.last_used > SESSION_TTL_SECONDS:
                self._drop_session(old_id)

        session = self._sessions.pop(session_id, None)
        if session is None:
            session = self._new_session()
        while len(self._sessions) >= MAX_SESSIONS:
            self._drop_session(next(iter(self._sessions)))
        session.last_used = now
        self._sessions[session_id] = session
        return session

    def predict(self, session_id: str, encoded_frame: bytes) -> dict[str, Any]:
        with self._lock:
            encoded = self._np.frombuffer(encoded_frame, dtype=self._np.uint8)
            frame = self._cv2.imdecode(encoded, self._cv2.IMREAD_COLOR)
            if frame is None:
                raise ValueError("Frame must be a decodable JPEG image.")
            if self.mode == "SignBridge Hand Landmark MLP":
                (
                    label,
                    confidence,
                    found,
                    landmarks,
                    face_detected,
                    face_landmarks,
                    facial_cues,
                ) = self.landmark_classifier.predict(
                    self._cv2.cvtColor(frame, self._cv2.COLOR_BGR2RGB)
                )
                return {
                    "label": label,
                    "confidence": confidence,
                    "source": "static" if found else "none",
                    "handDetected": found,
                    "landmarks": landmarks,
                    "faceDetected": face_detected,
                    "faceLandmarks": face_landmarks,
                    "facialCues": facial_cues,
                }
            frame = self._cv2.flip(frame, 1)
            if self.mode == "ASL Alphabet TinyCNN":
                label, confidence = self.tiny_classifier.predict(frame)
                found = label.lower() != "nothing"
                return {
                    "label": label if found else "No hand",
                    "confidence": confidence,
                    "source": "static" if found else "none",
                    "handDetected": found,
                }

            session = self._get_session(session_id)
            landmarks, _ = session.detector.detect(frame)
            if landmarks is None:
                session.sequence.clear()
                session.recent_predictions.clear()
                return {
                    "label": "No hand",
                    "confidence": None,
                    "source": "none",
                    "handDetected": False,
                }

            feature_vector = self._feature_vector(landmarks)
            static_label, _, static_confidence = self._predict_sign(
                self.static_model, feature_vector, self.static_confidence
            )
            session.sequence.append(feature_vector)
            label, confidence, source = static_label, static_confidence, "static"

            if len(session.sequence) == self.sequence_length:
                window = self._np.stack(session.sequence, axis=0)
                motion_label, _, motion_confidence = self._predict_gru(
                    self.sequence_model,
                    window,
                    self.sequence_meta["classes"],
                    self.sequence_confidence,
                )
                motion_score = self._motion_score(window)
                if self._accept_motion(
                    motion_label,
                    motion_confidence,
                    motion_score,
                    self.motion_threshold,
                ):
                    label, confidence, source = motion_label, motion_confidence, "motion"

            session.recent_predictions.append(label)
            if len(session.recent_predictions) == self.smoothing_window:
                label = Counter(session.recent_predictions).most_common(1)[0][0]
            return {
                "label": label,
                "confidence": confidence,
                "source": source,
                "handDetected": True,
            }

    @property
    def motion_ready(self) -> bool:
        if self.mode == "SignBridge-ML":
            return True
        if self.mode != "SignBridge Hand Landmark MLP":
            return False
        from signbridge_service.motion import is_motion_recognizer_configured

        return is_motion_recognizer_configured()

    def recognize_motion(self, session_id: str, encoded_frames: list[bytes]) -> dict[str, Any]:
        if self.mode == "SignBridge-ML":
            result: dict[str, Any] = {
                "label": "Uncertain",
                "confidence": None,
                "source": "none",
                "handDetected": False,
            }
            for frame in encoded_frames:
                result = self.predict(session_id, frame)
                if result["source"] == "motion":
                    return result
            return result if result["source"] == "motion" else {
                "label": "Uncertain" if result["handDetected"] else "No hand",
                "confidence": result["confidence"],
                "source": "none",
                "handDetected": result["handDetected"],
            }

        if self.mode != "SignBridge Hand Landmark MLP":
            from signbridge_service.motion import MotionRecognizerUnavailable

            raise MotionRecognizerUnavailable(
                "Motion recognition needs the hand landmark model with a configured vision provider, or a trained SignBridge-ML sequence model."
            )
        if not self.motion_ready:
            from signbridge_service.motion import MotionRecognizerUnavailable

            raise MotionRecognizerUnavailable(
                "Motion words need an optional vision model provider. Configure SIGNBRIDGE_PROVIDER and credentials for the Python service; static hand-letter recognition works without it."
            )

        rgb_frames = []
        hands_detected = 0
        for encoded_frame in encoded_frames:
            encoded = self._np.frombuffer(encoded_frame, dtype=self._np.uint8)
            frame = self._cv2.imdecode(encoded, self._cv2.IMREAD_COLOR)
            if frame is None:
                raise ValueError("Every motion frame must be a decodable JPEG image.")
            rgb = self._cv2.cvtColor(frame, self._cv2.COLOR_BGR2RGB)
            _, _, found, _, _, _, _ = self.landmark_classifier.predict(rgb)
            hands_detected += int(found)
            rgb_frames.append(rgb)

        if hands_detected < max(2, (len(encoded_frames) + 2) // 3):
            return {"label": "No hand", "confidence": None, "source": "none", "handDetected": False}

        from signbridge_service.motion import MotionRecognitionFailed, recognize_motion

        try:
            label = recognize_motion(rgb_frames, self._cv2)
        except MotionRecognitionFailed:
            raise
        return {
            "label": label or "Uncertain",
            "confidence": None,
            "source": "motion" if label else "none",
            "handDetected": True,
        }

    def reset(self, session_id: str) -> None:
        with self._lock:
            self._drop_session(session_id)

    def close(self) -> None:
        with self._lock:
            if self.mode == "SignBridge-ML":
                for session_id in list(self._sessions):
                    self._drop_session(session_id)
            elif self.mode == "SignBridge Hand Landmark MLP":
                self.landmark_classifier.close()


class SignBridgeRequestHandler(BaseHTTPRequestHandler):
    server: "SignBridgeHTTPServer"

    def _send_json(self, status: int, data: dict[str, Any]) -> None:
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self, max_bytes: int = MAX_REQUEST_BYTES) -> bytes:
        if self.headers.get_content_type() != "application/json":
            raise ValueError("Content-Type must be application/json.")
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError as error:
            raise ValueError("A valid Content-Length header is required.") from error
        if length < 0 or length > max_bytes:
            raise OverflowError("Request body is too large.")
        body = self.rfile.read(length)
        if len(body) != length:
            raise ValueError("Request body was incomplete.")
        return body

    def do_GET(self) -> None:
        if self.path != "/health":
            self._send_json(404, {"error": "Not found."})
            return
        self._send_json(200, {
            "status": "ok",
            "ready": True,
            "model": self.server.engine.mode,
            "motionReady": self.server.engine.motion_ready,
            "faceTrackingReady": self.server.engine.mode == "SignBridge Hand Landmark MLP",
        })

    def do_POST(self) -> None:
        if self.path not in ("/predict", "/motion", "/reset"):
            self._send_json(404, {"error": "Not found."})
            return
        try:
            max_bytes = MAX_MOTION_REQUEST_BYTES if self.path == "/motion" else MAX_REQUEST_BYTES
            body = self._read_body(max_bytes)
            if self.path == "/predict":
                session_id, frame = parse_prediction_request(body)
                self._send_json(200, self.server.engine.predict(session_id, frame))
            elif self.path == "/motion":
                session_id, frames = parse_motion_request(body)
                self._send_json(200, self.server.engine.recognize_motion(session_id, frames))
            else:
                session_id = parse_reset_request(body)
                self.server.engine.reset(session_id)
                self._send_json(200, {"reset": True})
        except OverflowError as error:
            self._send_json(413, {"error": str(error)})
        except ValueError as error:
            self._send_json(400, {"error": str(error)})
        except Exception as error:
            from signbridge_service.motion import MotionRecognitionFailed, MotionRecognizerUnavailable

            if isinstance(error, MotionRecognizerUnavailable):
                self._send_json(503, {"error": str(error)})
                return
            if isinstance(error, MotionRecognitionFailed):
                self._send_json(502, {"error": str(error)})
                return
            LOGGER.exception("SignBridge request failed.")
            self._send_json(500, {"error": "SignBridge could not process this frame."})

    def log_message(self, format: str, *args: Any) -> None:
        LOGGER.info("%s - %s", self.client_address[0], format % args)


class SignBridgeHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address: tuple[str, int], engine: SignBridgeEngine):
        self.engine = engine
        super().__init__(address, SignBridgeRequestHandler)


def main() -> int:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    project_dir = os.getenv("SIGNBRIDGE_ML_PATH")
    host = os.getenv("SIGNBRIDGE_HOST", "127.0.0.1")
    try:
        if not ipaddress.ip_address(host).is_loopback:
            LOGGER.error("SIGNBRIDGE_HOST must be a loopback IP address.")
            return 2
    except ValueError:
        LOGGER.error("SIGNBRIDGE_HOST must be a loopback IP address, such as 127.0.0.1.")
        return 2

    try:
        port = int(os.getenv("SIGNBRIDGE_PORT", "8001"))
        if not 1 <= port <= 65535:
            raise ValueError
        engine = SignBridgeEngine(Path(project_dir) if project_dir else None)
    except (ValueError, FileNotFoundError, ImportError, KeyError, RuntimeError):
        LOGGER.exception("Could not initialize SignBridge-ML. Check its Python dependencies, config, and trained models.")
        return 2
    except Exception:
        LOGGER.exception("Unexpected error while initializing SignBridge-ML.")
        return 2

    server = SignBridgeHTTPServer((host, port), engine)
    LOGGER.info("SignBridge model service listening at http://%s:%s", host, port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        LOGGER.info("Shutting down SignBridge model service.")
    finally:
        server.server_close()
        engine.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
