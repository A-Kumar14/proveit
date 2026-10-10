import base64
import json
import unittest
import uuid

from signbridge_service.server import (
    MAX_FRAME_BYTES,
    MAX_MOTION_FRAMES,
    parse_motion_request,
    parse_prediction_request,
    parse_reset_request,
)


class SignBridgeProtocolTests(unittest.TestCase):
    def setUp(self):
        self.session_id = str(uuid.uuid4())

    def test_parses_prediction_frame_and_session_id(self):
        frame = b"\xff\xd8sample-jpeg\xff\xd9"
        body = json.dumps({
            "sessionId": self.session_id,
            "image": base64.b64encode(frame).decode("ascii"),
        }).encode("utf-8")

        session_id, decoded = parse_prediction_request(body)

        self.assertEqual(session_id, self.session_id)
        self.assertEqual(decoded, frame)

    def test_rejects_invalid_request_shapes_and_encoded_frames(self):
        cases = (
            b"not json",
            json.dumps({"sessionId": "invalid", "image": "aGVsbG8="}).encode(),
            json.dumps({"sessionId": self.session_id, "image": "not base64!"}).encode(),
        )
        for body in cases:
            with self.subTest(body=body), self.assertRaises(ValueError):
                parse_prediction_request(body)

    def test_rejects_frames_over_the_limit(self):
        frame = b"x" * (MAX_FRAME_BYTES + 1)
        body = json.dumps({
            "sessionId": self.session_id,
            "image": base64.b64encode(frame).decode("ascii"),
        }).encode("utf-8")

        with self.assertRaisesRegex(ValueError, "too large"):
            parse_prediction_request(body)

    def test_parses_reset_session_and_rejects_non_objects(self):
        body = json.dumps({"sessionId": self.session_id}).encode("utf-8")
        self.assertEqual(parse_reset_request(body), self.session_id)
        with self.assertRaisesRegex(ValueError, "JSON object"):
            parse_reset_request(b"[]")

    def test_parses_ordered_motion_frames(self):
        frames = [b"\xff\xd8frame-one\xff\xd9", b"\xff\xd8frame-two\xff\xd9"]
        body = json.dumps({
            "sessionId": self.session_id,
            "frames": [base64.b64encode(frame).decode("ascii") for frame in frames],
        }).encode("utf-8")

        session_id, decoded = parse_motion_request(body)

        self.assertEqual(session_id, self.session_id)
        self.assertEqual(decoded, frames)

    def test_rejects_invalid_motion_frame_counts_and_data(self):
        cases = (
            {"sessionId": self.session_id, "frames": ["YQ=="]},
            {"sessionId": self.session_id, "frames": ["YQ==", "bad!"]},
            {"sessionId": self.session_id, "frames": ["YQ=="] * (MAX_MOTION_FRAMES + 1)},
        )
        for data in cases:
            with self.subTest(data=data), self.assertRaises(ValueError):
                parse_motion_request(json.dumps(data).encode("utf-8"))


if __name__ == "__main__":
    unittest.main()
