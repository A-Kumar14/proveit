// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduledGroup, ScheduledTask } from "@proveit/server/schedule";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
const setTaskDone = vi.fn();
const setCoursesCompleted = vi.fn();
vi.mock("@proveit/lib/api", () => ({ api: { setTaskDone: (...a: unknown[]) => setTaskDone(...a), setCoursesCompleted: (...a: unknown[]) => setCoursesCompleted(...a) } }));
const fire = vi.fn();
vi.mock("./useConfetti", () => ({ useConfetti: () => fire }));

import { TodoCard } from "./TodoCard";

const task = (over: Partial<ScheduledTask>): ScheduledTask => ({ id: "t", title: "Task", courseId: "c", courseName: "Course", state: "developing", kind: "practice", done: false, doneBy: null, href: null, why: "Started, not yet proved", slot: null, next: false, ...over });
const group = (over: Partial<ScheduledGroup> = {}): ScheduledGroup => ({
  courseId: "stats", courseName: "Intro Statistics", total: 4, doneCount: 2,
  open: [task({ id: "cii", title: "CI interpretation", state: "needs_work", why: "Open misconception", href: "/course/stats/practice/cii", next: true, slot: { start: "2026-10-12T16:30:00.000Z", end: "2026-10-12T17:00:00.000Z" } }), task({ id: "pv", title: "p-value", state: "not_started", why: "Not started" })],
  done: [task({ id: "pop", title: "Population", done: true, doneBy: "progress" }), task({ id: "var", title: "Variability", done: true, doneBy: "you" })],
  ...over,
});

beforeEach(() => { localStorage.clear(); refresh.mockReset(); fire.mockReset(); setTaskDone.mockReset().mockResolvedValue({ ok: true }); setCoursesCompleted.mockReset().mockResolvedValue({ updated: [] }); });
afterEach(cleanup);

describe("TodoCard", () => {
  it("shows open tasks with the next one flagged, a suggested time and a Start link", () => {
    render(<TodoCard groups={[group()]} />);
    const cii = screen.getByText("CI interpretation").closest("li")!;
    expect(within(cii).getByText("Next")).toBeTruthy();
    expect(within(cii).getByText(/Suggested/)).toBeTruthy();
    expect(within(cii).getByRole("link", { name: "Start" }).getAttribute("href")).toBe("/course/stats/practice/cii");
    expect(within(screen.getByText("p-value").closest("li")!).getByText("Not in demo")).toBeTruthy();
    expect(screen.getByText("2 of 4 done")).toBeTruthy();
  });

  it("ticks a task by hand: saves it, bursts confetti and refreshes", async () => {
    render(<TodoCard groups={[group()]} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Mark p-value done" }));
    expect(setTaskDone).toHaveBeenCalledWith("pv", true);
    expect(fire).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
  });

  it("locks tasks your answers finished and lets you untick the ones you ticked", async () => {
    render(<TodoCard groups={[group()]} />);
    await userEvent.click(screen.getByText(/^Done \(2\)/));
    expect((screen.getByRole("checkbox", { name: /Population, finished by your answers/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("checkbox", { name: "Mark Variability not done" }));
    expect(setTaskDone).toHaveBeenCalledWith("var", false);
    expect(fire).not.toHaveBeenCalled();
  });

  it("marks a whole course done from the group header", async () => {
    render(<TodoCard groups={[group()]} />);
    await userEvent.click(screen.getByRole("button", { name: "Mark course done" }));
    expect(setCoursesCompleted).toHaveBeenCalledWith(["stats"], true);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("shows the error and skips confetti when saving fails", async () => {
    setTaskDone.mockRejectedValue(new Error("Not found."));
    render(<TodoCard groups={[group()]} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Mark p-value done" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Not found.");
    expect(fire).not.toHaveBeenCalled();
  });

  it("celebrates once when your answers finish a task since the last visit, but not on the first visit", () => {
    const { unmount } = render(<TodoCard groups={[group()]} />);
    expect(fire).not.toHaveBeenCalled();
    unmount();
    const finished = group({ done: [...group().done, task({ id: "cii", title: "CI interpretation", done: true, doneBy: "progress" })] });
    const { unmount: u2 } = render(<TodoCard groups={[finished]} />);
    expect(fire).toHaveBeenCalledTimes(1);
    u2();
    render(<TodoCard groups={[finished]} />);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("says so when every course is completed or no tasks are left", () => {
    const { rerender } = render(<TodoCard groups={[]} />);
    expect(screen.getByText(/Every course is completed/)).toBeTruthy();
    rerender(<TodoCard groups={[group({ open: [] })]} />);
    expect(screen.getByText(/All tasks done/)).toBeTruthy();
  });
});
