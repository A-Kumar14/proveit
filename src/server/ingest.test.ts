import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
let ai = false;
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a), Output: { object: (o: unknown) => o } }));
vi.mock("./ai", () => ({ aiEnabled: () => ai, model: () => "mock-model" }));

import { createCourse, readSources, type Source } from "./ingest";
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

describe("createCourse", () => {
  it("keeps the structure of markdown with headings, with no AI", async () => {
    const r = await createCourse("Biology", [src("bio.md", MD)], "upload");
    expect(r).toEqual({ id: "biology", concepts: 3 });
    expect(getCourse("biology").concepts.map((c) => c.name)).toEqual(["Membrane", "Nucleus", "Mitochondria"]);
    expect(getSidebar().courses.find((c) => c.id === "biology")).toMatchObject({ name: "Biology", completed: false });
    expect(listMaterials("biology").map((m) => m.name)).toEqual(["bio.md"]);
  });

  it("gives a second course with the same name its own id", async () => {
    await createCourse("Biology", [src("a.md", MD)], "upload");
    expect((await createCourse("Biology", [src("b.md", MD)], "upload")).id).toBe("biology-2");
  });

  it("asks the model for an outline when the notes have no headings, and keeps the notes as a file", async () => {
    ai = true;
    generateText.mockResolvedValueOnce({ output: { topic: "Science", summary: "Cells.", units: [{ name: "Cells", concepts: [{ name: "Membrane", desc: "Controls entry." }, { name: "Nucleus", desc: "Holds DNA." }, { name: "Cytoplasm", desc: "Gel inside." }] }] } });
    const r = await createCourse("Bio notes", [src("notes.txt", "Cells have a membrane, a nucleus and cytoplasm.")], "upload");
    expect(r.concepts).toBe(3);
    expect(generateText.mock.calls[0]![0].prompt).toContain("Cells have a membrane");
    expect(listMaterials("bio-notes")[0]!.text).toContain("nucleus");
  });

  it("refuses plain notes with no AI key, instead of guessing at concepts", async () => {
    await expect(createCourse("Notes", [src("n.txt", "Just a paragraph of text about nothing in particular.")], "upload")).rejects.toThrow(/no AI key/);
    expect(getSidebar().courses.some((c) => c.id === "notes")).toBe(false);
  });

  it("refuses a missing name or no files", async () => {
    await expect(createCourse("  ", [src("a.md", MD)], "upload")).rejects.toBeInstanceOf(MaterialError);
    await expect(createCourse("X", [], "upload")).rejects.toBeInstanceOf(MaterialError);
  });

  it("caps the concepts the model returns", async () => {
    ai = true;
    const many = Array.from({ length: 8 }, (_, u) => ({ name: `Unit ${u}`, concepts: Array.from({ length: 10 }, (_, c) => ({ name: `C${u}-${c}`, desc: "d" })) }));
    generateText.mockResolvedValueOnce({ output: { topic: "T", summary: "S", units: many } });
    expect((await createCourse("Big", [src("b.txt", "text without headings here")], "upload")).concepts).toBe(40);
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
