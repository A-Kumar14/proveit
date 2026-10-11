import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closePersistenceForTests } from "@proveit/server/persistence";
import { GET, POST } from "./route";
import { POST as usage } from "../voice/usage/route";
import { POST as reset } from "../courses/reset/route";
import { GET as exportData } from "../account/export/route";

const DB = join(tmpdir(), "proveit-prefs-route-test.sqlite");
const clear = () => { for (const s of ["", "-shm", "-wal"]) if (existsSync(DB + s)) rmSync(DB + s); };
const post = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => { closePersistenceForTests(); clear(); process.env.PROVEIT_DB_PATH = DB; (globalThis as { __proveit?: unknown }).__proveit = undefined; });
afterEach(() => { closePersistenceForTests(); clear(); delete process.env.PROVEIT_DB_PATH; });

describe("/api/prefs", () => {
  it("saves a choice and returns it on the next read", async () => {
    expect((await POST(post({ quizLength: 12 }))).status).toBe(200);
    expect(await (await GET()).json()).toMatchObject({ quizLength: 12, detail: "brief" });
  });
  it("refuses a voice that isn't on the list", async () => {
    expect((await POST(post({ tutorVoice: "somebody-else" }))).status).toBe(400);
  });
});

describe("/api/voice/usage", () => {
  it("adds up what the browser reports", async () => {
    await usage(post({ seconds: 120 }));
    expect(await (await usage(post({ seconds: 60 }))).json()).toEqual({ seconds: 180, calls: 2 });
  });
  it("needs a number", async () => {
    expect((await usage(post({ seconds: "lots" }))).status).toBe(400);
  });
});

describe("/api/courses/reset", () => {
  it("starts a course over, and refuses one that doesn't exist", async () => {
    expect((await reset(post({ courseId: "intro-stats" }))).status).toBe(200);
    expect((await reset(post({ courseId: "nope" }))).status).toBe(404);
    expect((await reset(post({}))).status).toBe(400);
  });
});

describe("/api/account/export", () => {
  it("downloads the learner's record as a file", async () => {
    const res = await exportData();
    expect(res.headers.get("content-disposition")).toContain("mastery-export.json");
    const json = await res.json();
    expect(json.courses.length).toBeGreaterThan(0);
    expect(json.preferences).toHaveProperty("tutorVoice");
  });
});
