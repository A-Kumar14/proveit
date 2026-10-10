import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
const ai = { on: false };
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a), Output: { object: (o: unknown) => o } }));
vi.mock("@proveit/server/ai", () => ({ aiEnabled: () => ai.on, model: () => "mock-model" }));

import { getCourse, getFiles, getRewards, getSidebar } from "@proveit/server/store";
import { POST } from "./route";

const send = (fields: Record<string, string>, files: File[] = []) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  for (const f of files) form.append("files", f);
  return POST(new Request("http://x/api/courses/upload", { method: "POST", body: form }));
};
const md = (text: string) => new File([text], "outline.md", { type: "" });
const pdf = () => new File([new Uint8Array(10)], "syllabus.pdf", { type: "application/pdf" });
const OUTLINE = "## Week 1: Cells\n- Cell membrane\n- Organelles\n## Week 2: Genetics\n- DNA replication";

beforeEach(() => {
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  ai.on = false;
  generateText.mockReset();
});

describe("POST /api/courses/upload", () => {
  it("rejects a missing name, missing rights, no files and unsupported types", async () => {
    expect((await send({ rights: "1" }, [md(OUTLINE)])).status).toBe(400);
    expect((await send({ name: "Bio" }, [md(OUTLINE)])).status).toBe(400);
    expect((await send({ name: "Bio", rights: "1" })).status).toBe(400);
    expect((await send({ name: "Bio", rights: "1" }, [new File(["x"], "deck.pptx", { type: "application/vnd.ms-powerpoint" })])).status).toBe(400);
  });

  it("builds a viewable course from a Markdown outline without a model key", async () => {
    const res = await send({ name: "Biology 101", rights: "1" }, [md(OUTLINE)]);
    expect(res.status).toBe(200);
    const { courseId } = await res.json();
    expect(courseId).toBe("biology-101");
    const c = getCourse(courseId);
    expect(c.concepts.map((x) => [x.name, x.unit, x.x, x.y, x.state])).toEqual([
      ["Cell membrane", "01 CELLS", 120, 72, "not_started"],
      ["Organelles", "01 CELLS", 120, 165, "not_started"],
      ["DNA replication", "02 GENETICS", 360, 72, "not_started"],
    ]);
    expect(c.edges).toEqual([]);
    expect(getFiles(courseId).files[0]).toMatchObject({ name: "outline.md", kind: "Notes, uploaded" });
    expect(getSidebar().courses.some((x) => x.id === courseId)).toBe(true);
  });

  it("gives a second course with the same name its own id, and adds no rank points", async () => {
    const before = getRewards().points;
    const a = await (await send({ name: "Bio", rights: "1" }, [md(OUTLINE)])).json();
    const b = await (await send({ name: "Bio", rights: "1" }, [md(OUTLINE)])).json();
    expect([a.courseId, b.courseId]).toEqual(["bio", "bio-2"]);
    expect(getRewards().points).toBe(before);
  });

  it("says why when an outline has no concepts", async () => {
    const res = await send({ name: "Bio", rights: "1" }, [md("Just prose, no headings or bullets.")]);
    expect(res.status).toBe(422);
  });

  it("refuses PDFs with 501 when no model key is set", async () => {
    expect((await send({ name: "Bio", rights: "1" }, [pdf()])).status).toBe(501);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("with a key, keeps only prerequisites that point forward between real concepts", async () => {
    ai.on = true;
    generateText.mockResolvedValueOnce({ output: {
      isCourseMaterial: true, reason: "A syllabus.",
      units: [
        { name: "Sampling", concepts: [{ name: "Sampling variability", short: "Variability", desc: "Explain why statistics vary." }] },
        { name: "Inference", concepts: [{ name: "Standard error", short: "Std. error", desc: "Compute SE." }, { name: "Margin of error", short: "Margin", desc: "Find the margin." }] },
      ],
      prerequisites: [
        { from: "Sampling variability", to: "Standard error" },
        { from: "Standard error", to: "Margin of error" },
        { from: "Margin of error", to: "Sampling variability" },
        { from: "Made up", to: "Standard error" },
        { from: "Standard error", to: "Standard error" },
      ],
    } });
    const { courseId } = await (await send({ name: "Stats", rights: "1" }, [pdf()])).json();
    const c = getCourse(courseId);
    const id = (n: string) => c.concepts.find((x) => x.name === n)!.id;
    expect(c.edges).toEqual([[id("Sampling variability"), id("Standard error")], [id("Standard error"), id("Margin of error")]]);
    expect(generateText.mock.calls[0]![0].messages[0].content[1]).toMatchObject({ type: "file", mediaType: "application/pdf" });
  });

  it("with a key, refuses files that are not course material", async () => {
    ai.on = true;
    generateText.mockResolvedValueOnce({ output: { isCourseMaterial: false, reason: "This is a grocery receipt.", units: [], prerequisites: [] } });
    const res = await send({ name: "Bio", rights: "1" }, [pdf()]);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("This is a grocery receipt.");
  });
});
