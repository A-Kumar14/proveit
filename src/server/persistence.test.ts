import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { demoStateForTests } from "../test/demo-state";
import { closePersistenceForTests, loadJson, saveJson } from "./persistence";
import { assess, getCourse } from "./store";

const DB = join(tmpdir(), "proveit-persistence-test.sqlite");
type TestGlobal = { __proveit?: unknown; __proveitTestSeedFactory?: () => unknown };

beforeEach(() => {
  closePersistenceForTests();
  for (const suffix of ["", "-shm", "-wal"]) {
    const path = DB + suffix;
    if (existsSync(path)) rmSync(path);
  }
  process.env.PROVEIT_DB_PATH = DB;
  const g = globalThis as unknown as TestGlobal;
  g.__proveit = undefined;
  g.__proveitTestSeedFactory = undefined;
});

afterEach(() => {
  closePersistenceForTests();
  for (const suffix of ["", "-shm", "-wal"]) {
    const path = DB + suffix;
    if (existsSync(path)) rmSync(path);
  }
  delete process.env.PROVEIT_DB_PATH;
  const g = globalThis as unknown as TestGlobal;
  g.__proveit = undefined;
  g.__proveitTestSeedFactory = demoStateForTests;
});

describe("SQLite persistence", () => {
  it("round-trips structured JSON", () => {
    saveJson("x", { hello: "world", rows: [1, 2, 3] });
    closePersistenceForTests();
    expect(loadJson("x")).toEqual({ hello: "world", rows: [1, 2, 3] });
  });

  it("restores learner progress after the in-memory cache is cleared", async () => {
    await assess({
      courseId: "intro-stats",
      conceptId: "cii",
      answer: "Across repeated samples, about 95% of intervals built by this method contain the true mean.",
    });
    expect(getCourse("intro-stats").concepts.find((c) => c.id === "cii")?.state).toBe("developing");

    (globalThis as unknown as TestGlobal).__proveit = undefined;
    closePersistenceForTests();

    expect(getCourse("intro-stats").concepts.find((c) => c.id === "cii")?.state).toBe("developing");
  });
});
