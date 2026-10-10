import { beforeEach, describe, expect, it } from "vitest";
import { listCourses } from "@proveit/server/store";
import { POST } from "./route";

const send = (body: unknown) => POST(new Request("http://x/api/courses/complete", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => { (globalThis as { __proveit?: unknown }).__proveit = undefined; });

describe("POST /api/courses/complete", () => {
  it("marks courses and returns the ids it changed", async () => {
    const res = await send({ ids: ["intro-stats"], completed: true });
    expect(await res.json()).toEqual({ updated: ["intro-stats"] });
    expect(listCourses().find((c) => c.id === "intro-stats")?.completed).toBe(true);
  });

  it("rejects an empty selection and unknown ids", async () => {
    expect((await send({ ids: [], completed: true })).status).toBe(400);
    expect((await send({ ids: ["nope"], completed: true })).status).toBe(404);
    expect((await send("garbage")).status).toBe(400);
  });
});
