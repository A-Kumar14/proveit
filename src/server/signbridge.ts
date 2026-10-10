import "server-only";
import { SignBridgeHealth as HealthSchema, SignBridgePrediction as PredictionSchema, type SignBridgePrediction } from "@proveit/lib/signbridge";

export const SIGNBRIDGE_MAX_BODY_BYTES = 1_400_000;

export async function readSignBridgeJson(request: Request, maxBytes = SIGNBRIDGE_MAX_BODY_BYTES): Promise<{ value: unknown } | { error: string; status: number }> {
  if (!request.body) return { error: "Request body is required.", status: 400 };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { error: "Frame request is too large.", status: 413 };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { value: JSON.parse(new TextDecoder().decode(body)) as unknown };
  } catch {
    return { error: "Request body must be valid JSON.", status: 400 };
  }
}

function normalizeServiceUrl(rawUrl = process.env.SIGNBRIDGE_SERVICE_URL ?? "http://127.0.0.1:8001") {
  return rawUrl.replace(/\/+$/, "");
}

export function getSignBridgeServiceUrl() {
  return normalizeServiceUrl();
}

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function checkSignBridgeHealth() {
  const url = new URL("/health", `${normalizeServiceUrl()}/`);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new Error(`No SignBridge model service responded at ${url.origin}. Start examples/signbridge/service.py with the quick demo model or a trained upstream model; see docs/signbridge.md.`);
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `The SignBridge service is unavailable (${response.status}).`;
    throw new Error(message);
  }
  const parsed = HealthSchema.safeParse(payload);
  if (!parsed.success) throw new Error(`A service is responding at ${url.origin}, but it is not a compatible SignBridge model service. Stop that service and start examples/signbridge/service.py; see docs/signbridge.md.`);
  return parsed.data;
}

export async function predictSignBridgeFrame(sessionId: string, image: string): Promise<SignBridgePrediction> {
  if (!image) {
    throw new Error("The camera frame is missing.");
  }

  const url = new URL("/predict", `${normalizeServiceUrl()}/`);
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ sessionId, image }),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    const message = typeof payload?.error === "string"
      ? payload.error
      : `The SignBridge model request failed (${response.status}).`;
    throw new Error(message);
  }

  const parsed = PredictionSchema.safeParse(payload);
  if (!parsed.success) throw new Error("The SignBridge service did not return a valid prediction.");
  return parsed.data;
}

export async function recognizeSignBridgeMotion(sessionId: string, frames: string[]): Promise<SignBridgePrediction> {
  const url = new URL("/motion", `${normalizeServiceUrl()}/`);
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sessionId, frames }),
    signal: AbortSignal.timeout(45_000),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    const message = typeof payload?.error === "string"
      ? payload.error
      : `The SignBridge motion request failed (${response.status}).`;
    throw new Error(message);
  }
  const parsed = PredictionSchema.safeParse(payload);
  if (!parsed.success) throw new Error("The SignBridge service did not return a valid motion prediction.");
  return parsed.data;
}

export async function resetSignBridgeSession(sessionId: string) {
  const url = new URL("/reset", `${normalizeServiceUrl()}/`);
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sessionId }),
    signal: AbortSignal.timeout(5_000),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `The SignBridge session could not be reset (${response.status}).`;
    throw new Error(message);
  }
  if (payload?.reset !== true) throw new Error("The SignBridge service returned an invalid reset response.");
}
