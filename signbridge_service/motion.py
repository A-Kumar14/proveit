"""Opt-in multi-frame ASL recognition using the SignBridge vision model."""

from __future__ import annotations

import base64
import os
import re
from functools import lru_cache
from typing import Any

ALPHABET = tuple("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
DIGITS = tuple("0123456789")
WORDS = (
    "hello", "thank_you", "name", "please", "sorry", "yes", "no", "good",
    "bad", "help", "want", "like", "love", "family", "friend", "mother",
    "father", "sister", "brother", "child", "home", "school", "work",
    "eat", "drink", "water", "food", "more", "finish", "today", "tomorrow",
    "yesterday", "where", "what", "who", "why", "when", "how", "go", "come",
    "see", "know", "understand", "think", "feel", "happy", "sad", "tired",
    "hungry", "wait",
)
VOCABULARY = frozenset((*ALPHABET, *DIGITS, *WORDS))
UNKNOWN = frozenset(("", "unknown", "none", "no_sign"))
PROMPT = (
    "Identify the American Sign Language sign shown in these images in temporal order. "
    "They are consecutive frames from one gesture; use the movement across frames, "
    "not an isolated pose. Reply with exactly one token from this vocabulary: "
    f"{' '.join(sorted(VOCABULARY))}. Use one uppercase letter for fingerspelling, "
    "a lowercase underscore-separated word for a lexical sign, or 'unknown' when "
    "no clear sign from the vocabulary is visible. Do not guess."
)


class MotionRecognizerUnavailable(RuntimeError):
    pass


class MotionRecognitionFailed(RuntimeError):
    pass


def _provider_config() -> tuple[str, str, str, str] | None:
    provider = os.getenv("SIGNBRIDGE_PROVIDER", "amd").lower()
    if provider == "amd":
        base_url = os.getenv("AMD_DEV_CLOUD_BASE_URL", "").rstrip("/")
        api_key = os.getenv("AMD_DEV_CLOUD_API_KEY", "")
        model = os.getenv("SIGNBRIDGE_VLM_MODEL", "Qwen/Qwen3-VL-32B-Instruct")
        return (provider, base_url, api_key, model) if base_url and api_key else None
    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY", "")
        model = os.getenv("SIGNBRIDGE_VLM_MODEL_OPENAI", "gpt-4o-mini")
        return (provider, "", api_key, model) if api_key else None
    if provider == "hf":
        api_key = os.getenv("HF_TOKEN", "")
        base_url = os.getenv("HF_INFERENCE_BASE_URL", "https://router.huggingface.co/v1")
        model = os.getenv("SIGNBRIDGE_VLM_MODEL_HF", "meta-llama/Llama-3.2-11B-Vision-Instruct")
        return (provider, base_url, api_key, model) if api_key else None
    return None


def is_motion_recognizer_configured() -> bool:
    return _provider_config() is not None


@lru_cache(maxsize=4)
def _client(provider: str, base_url: str, api_key: str, model: str) -> tuple[Any, str]:
    from openai import OpenAI

    client = OpenAI(base_url=base_url, api_key=api_key) if base_url else OpenAI(api_key=api_key)
    return client, model


def _normalise(token: str) -> str:
    cleaned = re.sub(r"[\s.!?,;:\"'`]+", " ", token).strip().split()
    if not cleaned:
        return ""
    value = cleaned[0]
    return value.upper() if len(value) == 1 and value.isalpha() else value.lower()


def recognize_motion(frames: list[Any], cv2: Any) -> str | None:
    configuration = _provider_config()
    if configuration is None:
        raise MotionRecognizerUnavailable(
            "Motion recognition is not configured. Set SIGNBRIDGE_PROVIDER and its API credentials in the Python service environment."
        )
    provider, base_url, api_key, model = configuration
    try:
        client, model = _client(provider, base_url, api_key, model)
        content: list[dict[str, Any]] = [{"type": "text", "text": PROMPT}]
        for frame in frames:
            bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
            ok, encoded = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 82])
            if not ok:
                raise MotionRecognitionFailed("A camera frame could not be encoded.")
            data_url = "data:image/jpeg;base64," + base64.b64encode(encoded).decode("ascii")
            content.append({"type": "image_url", "image_url": {"url": data_url}})
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": content}],
            temperature=0.0,
            max_tokens=12,
        )
        raw = response.choices[0].message.content or ""
    except MotionRecognitionFailed:
        raise
    except Exception as error:
        raise MotionRecognitionFailed(
            f"Motion recognition request failed ({type(error).__name__}). Check the model provider configuration and service logs."
        ) from error

    token = _normalise(raw)
    if token in UNKNOWN or token not in VOCABULARY:
        return None
    return token
