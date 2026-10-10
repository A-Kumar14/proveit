// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { CourseRow } from "@proveit/server/store";
import { CourseTicker } from "./CourseTicker";
import { TickerCard } from "./TickerCard";

afterEach(cleanup);
const course = (over: Partial<CourseRow> = {}): CourseRow => ({ id: "stats", name: "Intro Statistics", pct: 42, proven: 5, total: 12, needsWork: 1, inProgress: 3, notStarted: 3, next: "CI interpretation", completed: false, manual: false, openMisconception: null, ...over });

describe("CourseTicker", () => {
  it("renders one live copy and two hidden copies of every card", () => {
    const { container } = render(<CourseTicker count={1}><TickerCard c={course()} /></CourseTicker>);
    expect(container.querySelectorAll("li")).toHaveLength(3);
    const dups = container.querySelectorAll('[data-copy="dup"]');
    expect(dups).toHaveLength(2);
    dups.forEach((d) => { expect(d.getAttribute("aria-hidden")).toBe("true"); expect(d.hasAttribute("inert")).toBe(true); });
    expect(screen.getAllByRole("link", { name: "Intro Statistics" })).toHaveLength(1);
  });

  it("lets the student pause and resume the scrolling", async () => {
    const { container } = render(<CourseTicker count={1}><TickerCard c={course()} /></CourseTicker>);
    const region = container.querySelector(".ticker")!;
    expect(region.getAttribute("data-paused")).toBe("false");
    await userEvent.click(screen.getByRole("button", { name: "Pause scrolling" }));
    expect(region.getAttribute("data-paused")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Resume scrolling" }));
    expect(region.getAttribute("data-paused")).toBe("false");
  });
});

describe("TickerCard", () => {
  it("shows the four status counts as a table and the next concept", () => {
    render(<ul><TickerCard c={course()} /></ul>);
    const rows = screen.getAllByRole("row").map((r) => r.textContent);
    expect(rows).toEqual(["Completed5", "In progress3", "Needs work1", "Not started3"]);
    expect(screen.getByText("Next: CI interpretation")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("marks a finished course and says who finished it", () => {
    render(<ul><TickerCard c={course({ completed: true, manual: true, next: null })} /></ul>);
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Marked completed by you")).toBeTruthy();
  });
});
