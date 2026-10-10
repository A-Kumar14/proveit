import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
let ai = false;
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a), Output: { object: (o: unknown) => o } }));
vi.mock("./ai", () => ({ aiEnabled: () => ai, model: () => "mock-model" }));

import { createCourseFromSources, readSources, type Source } from "./ingest";
import { listMaterials, MaterialError } from "./materials";
import { getCourse, getSidebar } from "./store";

const src = (name: string, text: string): Source => ({ name, mime: "text/markdown", size: text.length, text, readBy: "text" });
const MD = "# Bio\n## Cells\n### Membrane\nThe membrane controls what enters.\n### Nucleus\nThe nucleus holds DNA.\n## Energy\n### Mitochondria\nMitochondria make ATP.\n";

beforeEach(() => {
  ai = false;
  generateText.mockReset();
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  (globalThis as { __proveitMaterials?: unknown }).__proveitMaterials = undefined;
});

describe("createCourseFromSources", () => {
  it("keeps the structure of markdown with headings, with no AI", async () => {
    const r = await createCourseFromSources("Biology", [src("bio.md", MD)], "Notes");
    expect(r).toEqual({ id: "biology", concepts: 3 });
    expect(getCourse("biology").concepts.map((c) => c.name)).toEqual(["Membrane", "Nucleus", "Mitochondria"]);
    expect(getSidebar().courses.find((c) => c.id === "biology")).toMatchObject({ name: "Biology", completed: false });
    expect(listMaterials("biology").map((m) => m.name)).toEqual(["bio.md"]);
  });

  it("gives a second course with the same name its own id", async () => {
    await createCourseFromSources("Biology", [src("a.md", MD)], "Notes");
    expect((await createCourseFromSources("Biology", [src("b.md", MD)], "Notes")).id).toBe("biology-2");
  });

  it("asks the model for an outline when the notes have no headings, and keeps the notes as a file", async () => {
    ai = true;
    generateText.mockResolvedValueOnce({ output: { isCourseMaterial: true, reason: "", prerequisites: [], units: [{ name: "Cells", concepts: [{ name: "Membrane", short: "Membrane", desc: "Controls entry." }, { name: "Nucleus", short: "Nucleus", desc: "Holds DNA." }] }] } });
    const r = await createCourseFromSources("Bio notes", [src("notes.txt", "Cells have a membrane and a nucleus.")], "Notes");
    expect(r.concepts).toBe(2);
    expect(listMaterials("bio-notes")[0]!.text).toContain("nucleus");
  });

  it("says so when the model decides the notes aren't course material", async () => {
    ai = true;
    generateText.mockResolvedValueOnce({ output: { isCourseMaterial: false, reason: "That is a shopping list.", prerequisites: [], units: [] } });
    await expect(createCourseFromSources("Stuff", [src("l.txt", "milk eggs bread")], "Notes")).rejects.toThrow(/shopping list/);
  });

  it("refuses plain notes with no AI key, instead of guessing at concepts", async () => {
    await expect(createCourseFromSources("Notes", [src("n.txt", "Just a paragraph of text about nothing in particular.")], "Notes")).rejects.toThrow(/no AI key/);
    expect(getSidebar().courses.some((c) => c.id === "notes")).toBe(false);
  });

  it("refuses a missing name or no files", async () => {
    await expect(createCourseFromSources("  ", [src("a.md", MD)], "Notes")).rejects.toBeInstanceOf(MaterialError);
    await expect(createCourseFromSources("X", [], "Notes")).rejects.toBeInstanceOf(MaterialError);
  });
});

describe("readSources", () => {
  it("reads what it can and reports the rest by name", async () => {
    const good = new File(["# T\nhello there"], "t.md", { type: "text/markdown" });
    const bad = new File(["x"], "x.exe", { type: "application/x-msdownload" });
    const r = await readSources([good, bad]);
    expect(r.sources.map((s) => s.name)).toEqual(["t.md"]);
    expect(r.failed).toEqual([{ name: "x.exe", reason: expect.stringContaining("isn't supported") }]);
  });
});
