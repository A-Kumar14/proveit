import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCalendarState } from "./calendar";
import { closePersistenceForTests } from "./persistence";
import { getEvidenceTrail, getHistory, getRewards, listCourses } from "./store";
import { getReviewQueue } from "./schedule";
import { demoStateForTests } from "../test/demo-state";

const DB = join(tmpdir(), "proveit-demo-branch-test.sqlite");
type TestGlobal = { __proveit?: unknown; __proveitCal?: unknown; __proveitTestSeedFactory?: () => unknown };

function clearFiles() {
  for (const suffix of ["", "-shm", "-wal"]) {
    const path = DB + suffix;
    if (existsSync(path)) rmSync(path);
  }
}

beforeEach(() => {
  closePersistenceForTests();
  clearFiles();
  process.env.PROVEIT_DB_PATH = DB;
  const g = globalThis as unknown as TestGlobal;
  g.__proveit = undefined;
  g.__proveitCal = undefined;
  g.__proveitTestSeedFactory = undefined;
});

afterEach(() => {
  closePersistenceForTests();
  clearFiles();
  delete process.env.PROVEIT_DB_PATH;
  const g = globalThis as unknown as TestGlobal;
  g.__proveit = undefined;
  g.__proveitCal = undefined;
  g.__proveitTestSeedFactory = demoStateForTests;
});

describe("isolated demo-data branch", () => {
  it("seeds the SQLite database with coherent product-wide sample state", () => {
    const courses = listCourses();
    expect(courses.map((c) => c.id)).toEqual(["intro-stats", "linear-algebra", "personal-finance"]);
    expect(getRewards().points).toBeGreaterThanOrEqual(6000);
    expect(getHistory().length).toBeGreaterThanOrEqual(4);
    expect(getEvidenceTrail("a2").map((a) => a.id)).toEqual(["a2", "a3"]);

    const queue = getReviewQueue(new Date());
    expect(queue.some((row) => row.id === "review:se" && row.pressure === "review")).toBe(true);
    expect(queue.some((row) => row.id === "cii")).toBe(true);

    const calendar = getCalendarState();
    expect(calendar).toMatchObject({ mode: "ics", provider: "Demo calendar" });
    expect(calendar.events.length).toBeGreaterThanOrEqual(6);
  });

  it("reloads the same seeded state from SQLite rather than rebuilding a different sample", () => {
    const first = { courses: listCourses(), history: getHistory(), points: getRewards().points };
    const g = globalThis as unknown as TestGlobal;
    g.__proveit = undefined;
    g.__proveitCal = undefined;
    closePersistenceForTests();
    expect({ courses: listCourses(), history: getHistory(), points: getRewards().points }).toEqual(first);
  });
});
