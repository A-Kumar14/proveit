// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseRow } from "@proveit/server/store";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
const setCoursesCompleted = vi.fn();
vi.mock("@proveit/lib/api", () => ({ api: { setCoursesCompleted: (...a: unknown[]) => setCoursesCompleted(...a) } }));

import { CoursesTable } from "./CoursesTable";

const row = (over: Partial<CourseRow>): CourseRow => ({ id: "x", name: "X", pct: 10, proven: 1, total: 10, needsWork: 0, completed: false, manual: false, openMisconception: null, ...over });
const stats = row({ id: "stats", name: "Intro Statistics", pct: 42 });
const algebra = row({ id: "algebra", name: "Linear Algebra", pct: 100, proven: 8, total: 8, completed: true });

beforeEach(() => { refresh.mockReset(); setCoursesCompleted.mockReset().mockResolvedValue({ updated: [] }); });
afterEach(cleanup);

describe("CoursesTable", () => {
  it("groups courses by status and filters them", async () => {
    render(<CoursesTable rows={[stats, algebra]} />);
    expect(screen.getByRole("heading", { name: "In progress (1)" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Completed (1)" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^Completed/ }));
    expect(screen.queryByText("Intro Statistics")).toBeNull();
    expect(screen.getByText("Linear Algebra")).toBeTruthy();
  });

  it("marks only the selected in-progress courses as completed from the top button", async () => {
    render(<CoursesTable rows={[stats, algebra]} />);
    const mark = screen.getByRole("button", { name: "Mark as completed" }) as HTMLButtonElement;
    expect(mark.disabled).toBe(true);
    await userEvent.click(screen.getByLabelText("Select Intro Statistics"));
    await userEvent.click(screen.getByLabelText("Select Linear Algebra"));
    await userEvent.click(mark);
    expect(setCoursesCompleted).toHaveBeenCalledWith(["stats"], true);
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByText("Marked Intro Statistics as completed.")).toBeTruthy();
  });

  it("offers Mark as completed on right-click and acts on that one course", async () => {
    render(<CoursesTable rows={[stats, algebra]} />);
    await userEvent.pointer({ keys: "[MouseRight]", target: screen.getByText("Intro Statistics") });
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByText("Mark as in progress")).toBeNull();
    await userEvent.click(within(menu).getByText("Mark as completed"));
    expect(setCoursesCompleted).toHaveBeenCalledWith(["stats"], true);
  });

  it("offers Mark as in progress on a completed course and can undo", async () => {
    const { rerender } = render(<CoursesTable rows={[stats, algebra]} />);
    await userEvent.pointer({ keys: "[MouseRight]", target: screen.getByText("Linear Algebra") });
    await userEvent.click(within(screen.getByRole("menu")).getByText("Mark as in progress"));
    expect(setCoursesCompleted).toHaveBeenLastCalledWith(["algebra"], false);
    rerender(<CoursesTable rows={[stats, { ...algebra, completed: false, manual: true }]} />); // router.refresh() delivers fresh rows
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(setCoursesCompleted).toHaveBeenLastCalledWith(["algebra"], true);
  });

  it("right-clicking a selected row acts on the whole selection", async () => {
    const third = row({ id: "ds", name: "Data Structures" });
    render(<CoursesTable rows={[stats, third, algebra]} />);
    await userEvent.click(screen.getByLabelText("Select Intro Statistics"));
    await userEvent.click(screen.getByLabelText("Select Data Structures"));
    await userEvent.pointer({ keys: "[MouseRight]", target: screen.getByText("Data Structures") });
    await userEvent.click(within(screen.getByRole("menu")).getByText("Mark as completed (2)"));
    expect(setCoursesCompleted).toHaveBeenCalledWith(["stats", "ds"], true);
  });

  it("shows the error and keeps the selection when the request fails", async () => {
    setCoursesCompleted.mockRejectedValue(new Error("Not found."));
    render(<CoursesTable rows={[stats]} />);
    await userEvent.click(screen.getByLabelText("Select Intro Statistics"));
    await userEvent.click(screen.getByRole("button", { name: "Mark as completed" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Not found.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows an empty state for a filter with no courses", async () => {
    render(<CoursesTable rows={[stats]} />);
    await userEvent.click(screen.getByRole("button", { name: /^Completed/ }));
    expect(screen.getByText("No completed courses yet")).toBeTruthy();
  });
});
