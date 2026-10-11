import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSignBridgeHealth, getSignBridgeServiceUrl, predictSignBridgeFrame, recognizeSignBridgeMotion, resetSignBridgeSession } from "./signbridge";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getSignBridgeServiceUrl", () => {
  it("uses the configured service URL when present", () => {
    vi.stubEnv("SIGNBRIDGE_SERVICE_URL", "http://localhost:9000/");
    expect(getSignBridgeServiceUrl()).toBe("http://localhost:9000");
  });

  it("falls back to the local loopback service", () => {
    expect(getSignBridgeServiceUrl()).toBe("http://127.0.0.1:8001");
  });
});

describe("predictSignBridgeFrame", () => {
  it("surfaces the model response body on success", async () => {
    const landmarks = Array.from({ length: 21 }, (_, index) => [index / 20, index / 20]);
    const faceLandmarks = Array.from({ length: 12 }, (_, index) => [index / 12, index / 12]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        label: "A",
        confidence: 0.91,
        source: "static",
        handDetected: true,
        landmarks,
        faceDetected: true,
        faceLandmarks,
        facialCues: { mouthOpen: 0.1, browEyeGap: 1.2 },
      }),
    }));

    await expect(predictSignBridgeFrame(crypto.randomUUID(), "YWJj")).resolves.toMatchObject({
      label: "A",
      confidence: 0.91,
      source: "static",
      handDetected: true,
      landmarks,
      faceDetected: true,
      faceLandmarks,
      facialCues: { mouthOpen: 0.1, browEyeGap: 1.2 },
    });
  });

  it("throws the server message when the service rejects the frame", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Model failed to initialize." }),
    }));

    await expect(predictSignBridgeFrame(crypto.randomUUID(), "YWJj")).rejects.toThrow("Model failed to initialize.");
  });

  it("rejects an invalid prediction response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ label: "A", confidence: 0.91 }),
    }));

    await expect(predictSignBridgeFrame(crypto.randomUUID(), "YWJj")).rejects.toThrow("valid prediction");
  });
});

describe("recognizeSignBridgeMotion", () => {
  it("sends ordered frames and returns the motion result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ label: "hello", confidence: null, source: "motion", handDetected: true }),
    }));
    const sessionId = crypto.randomUUID();
    await expect(recognizeSignBridgeMotion(sessionId, ["YQ==", "Yg=="])).resolves.toMatchObject({
      label: "hello",
      source: "motion",
    });
    expect(fetch).toHaveBeenCalledWith(
      new URL("/motion", "http://127.0.0.1:8001/"),
      expect.objectContaining({ body: JSON.stringify({ sessionId, frames: ["YQ==", "Yg=="] }) }),
    );
  });
});

describe("SignBridge session health", () => {
  it("requires a ready model service", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", ready: true, model: "SignBridge-ML", motionReady: true }),
    }));
    await expect(checkSignBridgeHealth()).resolves.toMatchObject({ ready: true });
  });

  it("explains when another service is occupying the configured port", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, service: "signbridge" }),
    }));
    await expect(checkSignBridgeHealth()).rejects.toThrow("not a compatible SignBridge model service");
  });

  it("explains when the model service is not running", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(checkSignBridgeHealth()).rejects.toThrow("No SignBridge model service responded");
  });

  it("resets temporal prediction state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reset: true }),
    }));
    await expect(resetSignBridgeSession(crypto.randomUUID())).resolves.toBeUndefined();
  });
});
