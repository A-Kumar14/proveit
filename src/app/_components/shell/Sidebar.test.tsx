import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SidebarView } from "@proveit/server/store";
import { Sidebar } from "./Sidebar";

const view = (courses: SidebarView["courses"]): SidebarView => ({ courses, streak: 0, practiceHref: null, reviewsDue: 0 });
const html = (courses: SidebarView["courses"], courseId?: string) => renderToStaticMarkup(<Sidebar data={view(courses)} active="map" courseId={courseId} />);
const stats = { id: "stats", name: "Intro Statistics", pct: 42, completed: false };
const algebra = { id: "algebra", name: "Linear Algebra", pct: 100, completed: true };

describe("Sidebar course groups", () => {
  it("lists unfinished courses under In progress and hides Completed when empty", () => {
    const out = html([stats]);
    expect(out).toContain("In progress");
    expect(out).toContain("Intro Statistics");
    expect(out).not.toContain("Completed");
  });

  it("moves a finished course into a collapsed Completed group", () => {
    const out = html([stats, algebra]);
    const [progress, done] = out.split("Completed (1)");
    expect(progress).toContain("Intro Statistics");
    expect(progress).not.toContain("Linear Algebra");
    expect(done).toContain("Linear Algebra");
    expect(out).not.toMatch(/<details[^>]* open/);
  });

  it("opens the Completed group when you are inside a completed course", () => {
    expect(html([stats, algebra], "algebra")).toMatch(/<details[^>]* open/);
  });

  it("keeps tutor, practice, the misconception log and files off the sidebar", () => {
    const out = html([stats, algebra], "stats");
    expect(out).toContain('href="/signbridge"');
    expect(out).toContain("SignBridge");
    expect(out).not.toContain("Tutor");
    expect(out).not.toContain("Misconception log");
    expect(out).not.toContain("Course files");
  });

  it("says so when everything is completed", () => {
    expect(html([algebra])).toContain("Nothing in progress.");
  });
});
