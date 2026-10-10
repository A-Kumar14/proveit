import { beforeEach, describe, expect, it } from "vitest";
import { disconnectCalendar } from "./calendar";
import { getScheduledTodos, getSchedule } from "./schedule";
import { assess, getCourseEvents, getTodos, NotFoundError, setCoursesCompleted, setTaskDone, submitTransfer, TaskLockedError } from "./store";

const WRONG = "It means there's a 95% probability that the true population mean is inside our interval.";
const RIGHT = "About 95 of them. But for any one interval that's already calculated, there's no 95% chance. It either contains the mean or it doesn't.";
const group = (id: string) => getTodos().find((g) => g.courseId === id)!;

beforeEach(() => {
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  disconnectCalendar();
});

describe("to-do list", () => {
  it("lists open tasks per course, most urgent first, and counts finished ones", () => {
    const stats = group("intro-stats");
    expect(stats.open.map((t) => t.id)).toEqual(["cii", "var", "se", "cic", "nul", "pv", "err"]);
    expect(stats).toMatchObject({ total: 12, doneCount: 5 });
    expect(stats.done.every((t) => t.doneBy === "progress")).toBe(true);
    expect(getTodos().map((g) => g.courseId)).toEqual(["intro-stats", "personal-finance"]);
  });

  it("only links tasks that can be practiced", () => {
    expect(group("intro-stats").open.find((t) => t.id === "cii")?.href).toBe("/course/intro-stats/practice/cii");
    expect(group("intro-stats").open.find((t) => t.id === "pv")?.href).toBeNull();
    expect(group("personal-finance").open.every((t) => t.href === null)).toBe(true);
  });

  it("finishes a task by itself when a transfer question is passed", async () => {
    const { attemptId } = await assess({ courseId: "intro-stats", conceptId: "cii", answer: WRONG });
    expect(group("intro-stats").open[0]?.id).toBe("cii");
    await submitTransfer(attemptId, RIGHT);
    expect(group("intro-stats").open.map((t) => t.id)).not.toContain("cii");
    expect(group("intro-stats").done.find((t) => t.id === "cii")).toMatchObject({ doneBy: "progress" });
  });

  it("lets you tick a task by hand, untick it, and never changes mastery", () => {
    setTaskDone("pv", true);
    expect(group("intro-stats").done.find((t) => t.id === "pv")).toMatchObject({ doneBy: "you" });
    expect(group("intro-stats").open.map((t) => t.id)).not.toContain("pv");
    setTaskDone("pv", false);
    expect(group("intro-stats").open.map((t) => t.id)).toContain("pv");
    setTaskDone("cii", true);
    expect(getCourseEvents().some((e) => e.id === "review:cii")).toBe(false);
  });

  it("refuses to untick a task your answers finished, and unknown tasks", () => {
    expect(() => setTaskDone("pop", false)).toThrow(TaskLockedError);
    expect(() => setTaskDone("nope", true)).toThrow(NotFoundError);
  });

  it("drops a completed course from the list", () => {
    setCoursesCompleted(["personal-finance"], true);
    expect(getTodos().map((g) => g.courseId)).toEqual(["intro-stats"]);
  });
});

describe("schedule", () => {
  it("merges quizzes into the calendar and leaves out completed courses", () => {
    const titles = getSchedule().events.filter((e) => e.kind === "quiz").map((e) => e.title);
    expect(titles).toHaveLength(2);
    expect(titles[0]).toContain("Intro Statistics quiz");
    setCoursesCompleted(["intro-stats"], true);
    expect(getSchedule().events.filter((e) => e.kind === "quiz")).toHaveLength(1);
  });

  it("puts a review on the calendar the day it comes due", async () => {
    const { attemptId } = await assess({ courseId: "intro-stats", conceptId: "cii", answer: WRONG });
    await submitTransfer(attemptId, RIGHT);
    const review = getSchedule().events.find((e) => e.kind === "review");
    expect(review).toMatchObject({ title: "Review CI interpretation", allDay: true });
  });

  it("suggests a free slot for the three most urgent tasks, one per day, none for the rest", () => {
    const now = new Date(2026, 9, 12, 8, 0);
    const open = getScheduledTodos(now).flatMap((g) => g.open);
    const withSlot = open.filter((t) => t.slot);
    expect(withSlot).toHaveLength(3);
    expect(new Set(withSlot.map((t) => t.slot!.start.slice(0, 10))).size).toBe(3);
    expect(open.filter((t) => t.next).map((t) => t.id)).toEqual(["cii"]);
  });
});
