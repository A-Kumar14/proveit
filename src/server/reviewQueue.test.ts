import { beforeEach, describe, expect, it } from "vitest";
import { disconnectCalendar } from "./calendar";
import { getReviewQueue } from "./schedule";
import { assess, setCoursesCompleted, submitTransfer } from "./store";

const WRONG = "It means there's a 95% probability that the true population mean is inside our interval.";
const RIGHT = "About 95 of them. But for any one interval that's already calculated, there's no 95% chance. It either contains the mean or it doesn't.";

beforeEach(() => {
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  disconnectCalendar();
});

const now = new Date(2026, 9, 10, 8, 0);

describe("review queue", () => {
  it("orders open concepts by the sooner quiz, then by how far they are from mastered", () => {
    const rows = getReviewQueue(now);
    expect(rows.map((r) => r.id)).toEqual(["cii", "var", "se", "cic", "nul", "pv", "err", "pf-dbt", "pf-idx", "pf-tax", "pf-ret"]);
    expect(rows[0]).toMatchObject({ pressure: "quiz", href: "/course/intro-stats/practice/cii", because: "Before the quiz, Thu, Oct 15" });
    expect(rows.find((r) => r.id === "pf-dbt")).toMatchObject({ href: null, because: "Before the quiz, Fri, Oct 23" });
    expect(rows.filter((r) => r.slot)).toHaveLength(3);
    expect(rows.slice(3).every((r) => r.slot === null)).toBe(true);
  });

  it("uses the supplied clock when deciding whether a review is due", async () => {
    const { attemptId } = await assess({ courseId: "intro-stats", conceptId: "cii", answer: WRONG });
    await submitTransfer(attemptId, RIGHT);
    const concept = (globalThis as unknown as { __proveit: { course: { concepts: { id: string; nextReview: string | null }[] } } }).__proveit.course.concepts.find((c) => c.id === "cii");
    concept!.nextReview = "2026-10-11";
    expect(getReviewQueue(now).find((r) => r.id === "review:cii")?.href).toBeNull();
    const tomorrow = new Date(2026, 9, 11, 8, 0);
    expect(getReviewQueue(tomorrow).find((r) => r.id === "review:cii")?.href).toBe("/course/intro-stats/review/cii");
  });

  it("puts a due review ahead of quiz prep, and drops a course once it is completed", async () => {
    const { attemptId } = await assess({ courseId: "intro-stats", conceptId: "cii", answer: WRONG });
    await submitTransfer(attemptId, RIGHT);
    const concept = (globalThis as unknown as { __proveit: { course: { concepts: { id: string; nextReview: string | null }[] } } }).__proveit.course.concepts.find((c) => c.id === "cii");
    concept!.nextReview = "2026-10-10";
    const rows = getReviewQueue(now);
    expect(rows[0]).toMatchObject({ id: "review:cii", pressure: "review", because: "Due now", href: "/course/intro-stats/review/cii" });
    expect(rows.map((r) => r.id)).not.toContain("cii");
    setCoursesCompleted(["intro-stats"], true);
    expect(getReviewQueue(now).every((r) => r.courseName !== "Intro Statistics")).toBe(true);
  });
});
