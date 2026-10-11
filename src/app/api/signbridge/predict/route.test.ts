import { describe, expect, it } from "vitest";
import { POST } from "./route";

const post = (value: unknown) => POST(new Request("http://local/api/signbridge/predict", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: typeof value === "string" ? value : JSON.stringify(value),
}));

describe("POST /api/signbridge/predict", () => {
  it("rejects invalid session IDs and frame data before contacting the model service", async () => {
    expect((await post({ sessionId: "nope", image: "YWJj" })).status).toBe(400);
    expect((await post({ sessionId: crypto.randomUUID(), image: "not base64" })).status).toBe(400);
  });

  it("rejects oversized request bodies", async () => {
    expect((await post("x".repeat(1_400_001))).status).toBe(413);
  });
});
