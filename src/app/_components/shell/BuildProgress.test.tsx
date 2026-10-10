// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CourseJobView } from "@proveit/lib/schemas";
import { BuildProgress } from "./BuildProgress";

afterEach(cleanup);
const L = ["Reading your files", "Finding the topics", "Building the concept map", "Saving your notes for the tutor"];
const job = (states: ("waiting" | "active" | "done" | "failed")[], over: Partial<CourseJobView> = {}): CourseJobView => ({
  id: "j", name: "Discrete 1", stage: "outline", elapsedMs: 83_000, files: [{ name: "a.pdf", state: "done", note: "9,000 words" }],
  stages: L.map((label, i) => ({ id: ["reading", "outline", "building", "saving"][i]!, label, state: states[i]! })), ...over,
});

describe("BuildProgress", () => {
  it("marks done, current and waiting stages, and shows the time as m:ss", () => {
    render(<BuildProgress job={job(["done", "active", "waiting", "waiting"])} onCancel={() => {}} />);
    expect(screen.getByText("Building Discrete 1")).toBeTruthy();
    expect(screen.getByLabelText("Time so far").textContent).toBe("1:23");
    const items = within(screen.getByRole("list", { name: "Stages" })).getAllByRole("listitem", { hidden: false }).filter((li) => L.some((l) => li.textContent?.includes(l)));
    expect(items.map((li) => li.getAttribute("aria-current"))).toEqual([null, "step", null, null]);
    expect(screen.getByText(/, done/)).toBeTruthy();
    expect(screen.getByText(/, in progress/)).toBeTruthy();
    expect(screen.getAllByText(/, waiting/)).toHaveLength(2);
  });

  it("lists each file with what happened to it while reading", () => {
    render(<BuildProgress job={job(["active", "waiting", "waiting", "waiting"], { stage: "reading", files: [{ name: "a.pdf", state: "done", note: "9,000 words" }, { name: "b.pdf", state: "reading" }, { name: "c.pdf", state: "waiting" }, { name: "d.pdf", state: "failed", note: "d.pdf is over 10 MB." }] })} />);
    expect(screen.getByText("9,000 words")).toBeTruthy();
    expect(screen.getByText("Reading...")).toBeTruthy();
    expect(screen.getByText("Waiting")).toBeTruthy();
    expect(screen.getByText("d.pdf is over 10 MB.")).toBeTruthy();
  });

  it("offers Cancel only while running, and shows the reason when it stopped", () => {
    const { rerender } = render(<BuildProgress job={job(["done", "active", "waiting", "waiting"])} onCancel={() => {}} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    rerender(<BuildProgress job={job(["done", "failed", "waiting", "waiting"], { stage: "failed", error: "The AI took too long to answer." })} onCancel={() => {}} />);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("The AI took too long to answer.");
    expect(screen.getByText("The build stopped")).toBeTruthy();
  });
});
