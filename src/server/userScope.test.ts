import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearUserCachesForTests, runAsUser, scopedUserId, userStorageKey } from "./userScope";
import { closePersistenceForTests, loadJson, saveJson } from "./persistence";
import { assess, createCourse, getCourse, getEvidenceAttempt, getHistory, getRewards, getTodos, listCourses, recordQuiz, setTaskDone, setCoursesCompleted, submitTransfer } from "./store";
import { listMaterials, removeMaterial, saveMaterial } from "./materials";
import { disconnectCalendar, getCalendarState } from "./calendar";
import { startQuiz, submitQuiz } from "./quiz";
import * as evaluator from "./evaluator";
import * as auth from "./auth";
import { withUserRoute, withUserPage } from "./userBoundary";
import { POST as assessRoute } from "../app/api/assess/route";

let dir: string;
const cii = () => getCourse("intro-stats").concepts.find(c => c.id === "cii")!;
const sound = "Over repeated samples about 95% of intervals contain the true mean. A realized interval either contains it or does not.";
const uploaded = () => createCourse({ name: "Private Biology", outline: { units: [{ name: "Cells", concepts: [{ name: "Membrane", short: "Membrane", desc: "Explain transport." }] }], prerequisites: [] }, files: [] });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "proveit-users-"));
  vi.stubEnv("PROVEIT_DB_PATH", join(dir, "state.sqlite"));
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
  vi.stubEnv("CLERK_SECRET_KEY", "");
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
  closePersistenceForTests();
  clearUserCachesForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
  clearUserCachesForTests();
  closePersistenceForTests();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("account state isolation", () => {
  it("isolates evidence, runtime courses, files and rank in memory and after reload", async () => {
    const owned = await runAsUser("A", async () => {
      setTaskDone("se", true);
      const id = uploaded();
      const material = saveMaterial(id, { name: "secret.md", mime: "text/markdown", size: 8 }, "A private course", "text");
      const answer = await assess({ courseId: "intro-stats", conceptId: "cii", answer: sound });
      await submitTransfer(answer.attemptId, "About 95 intervals contain the true mean. One calculated interval either contains it or does not; 95% describes the method.");
      expect(cii().state).toBe("provisional");
      recordQuiz({
        courseId: "intro-stats",
        items: ["A", "B", "C", "D"].map((suffix) => ({
          conceptId: "cii", concept: "CI interpretation", prompt: `CI coverage ${suffix}`,
          options: ["right", "wrong"], picked: 0, correct: 0, explanation: "right",
        })),
      });
      expect(getRewards().points).toBeGreaterThan(0);
      return { id, material, attempt: answer.attemptId };
    });
    for (let reload = 0; reload < 2; reload++) {
      if (reload) { clearUserCachesForTests(); closePersistenceForTests(); }
      runAsUser("B", () => {
        expect(cii().state).toBe("not_started");
        expect(getHistory()).toEqual([]);
        expect(getRewards().points).toBe(0);
        expect(getTodos()[0].open.some(t => t.id === "se")).toBe(true);
        expect(listCourses().map(c => c.id)).not.toContain(owned.id);
        expect(() => getCourse(owned.id)).toThrow();
        expect(() => getEvidenceAttempt(owned.attempt)).toThrow();
        expect(() => setCoursesCompleted([owned.id], true)).toThrow();
        expect(() => removeMaterial(owned.id, owned.material.id)).toThrow();
        expect(listMaterials("intro-stats")).toEqual([]);
      });
      runAsUser("A", () => {
        expect(cii().state).toBe("provisional");
        expect(listMaterials(owned.id).map(m => m.text)).toEqual(["A private course"]);
        expect(getHistory()).toHaveLength(2);
        expect(getTodos()[0].done.some(t => t.id === "se" && t.doneBy === "you")).toBe(true);
        expect(getRewards().points).toBeGreaterThan(0);
      });
    }
  });

  it("keeps legacy unscoped data local, and scopes calendar writes and restoration", () => {
    const calendar = { mode: "ics", provider: "Private A", url: "https://example.com/private", syncedAt: 1, events: [] };
    saveJson("calendar", { ...calendar, provider: "Legacy local" });
    saveJson(runAsUser("A", () => userStorageKey("calendar")), calendar);
    runAsUser("A", () => expect(getCalendarState().provider).toBe("Private A"));
    runAsUser("B", () => { expect(getCalendarState().mode).toBe("none"); disconnectCalendar(); });
    clearUserCachesForTests(); closePersistenceForTests();
    runAsUser("A", () => expect(getCalendarState().provider).toBe("Private A"));
    expect(loadJson<{ provider: string }>("calendar")?.provider).toBe("Legacy local");
    expect(userStorageKey("learning")).toBe("learning");
    expect(runAsUser("A", () => userStorageKey("learning"))).not.toBe("learning");
  });

  it("rejects another account's quiz ID and keeps the owner's quiz usable", async () => {
    const quiz = await runAsUser("A", () => startQuiz("intro-stats"));
    runAsUser("B", () => expect(() => submitQuiz(quiz.quizId, [])).toThrow());
    runAsUser("A", () => expect(submitQuiz(quiz.quizId, []).total).toBeGreaterThan(0));
  });

  it("retains request identity through interleaved grading and failures", async () => {
    let release!: () => void;
    const wait = new Promise<void>(r => { release = r; });
    const judge = vi.spyOn(evaluator, "judgeAnswerForSpec").mockImplementation(async (_spec, answer) => {
      const user = scopedUserId();
      if (answer === "A") await wait;
      else release();
      expect(scopedUserId()).toBe(user);
      if (answer === "B") throw new Error("Model failed");
      return { verdict: "correct", quote: null, misconceptionId: null, votes: null };
    });
    const result = await Promise.allSettled([
      runAsUser("A", () => assess({ courseId: "intro-stats", conceptId: "cii", answer: "A" })),
      runAsUser("B", () => assess({ courseId: "intro-stats", conceptId: "cii", answer: "B" })),
    ]);
    expect(result.map(r => r.status)).toEqual(["fulfilled", "rejected"]);
    runAsUser("A", () => expect(getHistory()).toHaveLength(1));
    runAsUser("B", () => { expect(getHistory()).toEqual([]); expect(cii().state).toBe("not_started"); });
    judge.mockRestore();
    expect(scopedUserId()).toBe("local");
  });

  it("uses trusted identity for the real assessment API, ignoring a supplied user ID", async () => {
    vi.spyOn(auth, "currentUserId").mockResolvedValue("A");
    const res = await assessRoute(new Request("http://localhost/api/assess", { method: "POST", body: JSON.stringify({ courseId: "intro-stats", conceptId: "cii", answer: sound, userId: "B" }) }));
    expect(res.status).toBe(200);
    runAsUser("A", () => expect(cii().state).toBe("developing"));
    runAsUser("B", () => expect(cii().state).toBe("not_started"));
  });

  it("denies anonymous authenticated routes before execution and fails closed on unscoped reads", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    expect(() => getCourse("intro-stats")).toThrow(auth.UnauthorizedError);
    vi.spyOn(auth, "currentUserId").mockRejectedValue(new auth.UnauthorizedError());
    const body = vi.fn(() => new Response("private"));
    expect((await withUserRoute(body)()).status).toBe(401);
    expect(body).not.toHaveBeenCalled();
    await expect(withUserPage(body)()).rejects.toThrow("NEXT_REDIRECT");
    expect(body).not.toHaveBeenCalled();
  });
});
