import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
const ai = { on: false };
const pending: Promise<unknown>[] = [];
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a), Output: { object: (o: unknown) => o } }));
vi.mock("@proveit/server/ai", () => ({ aiEnabled: () => ai.on, model: () => "mock-model" }));
vi.mock("./../../../../server/ai", () => ({ aiEnabled: () => ai.on, model: () => "mock-model" }));
// `after` only works inside a real request, so the tests run the build where it would be scheduled and wait for it.
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => Promise<unknown>) => { pending.push(fn()); } }));

import { getJob } from "@proveit/server/courseJobs";
import { getCourse, getFiles, getRewards, getSidebar } from "@proveit/server/store";
import { POST } from "./route";

const send = (fields: Record<string, string>, files: File[] = []) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  for (const f of files) form.append("files", f);
  return POST(new Request("http://x/api/courses/upload", { method: "POST", body: form }));
};
/** Starts a build and waits for it to finish. */
const build = async (fields: Record<string, string>, files: File[]) => {
  const res = await send(fields, files);
  expect(res.status).toBe(202);
  const { jobId } = await res.json();
  await Promise.all(pending.splice(0));
  return getJob(jobId)!;
};
const md = (text: string) => new File([text], "outline.md", { type: "" });
const realPdf = () => new File([readFileSync("src/test/fixtures/week3-notes.pdf")], "week3-notes.pdf", { type: "application/pdf" });
const fakePdf = () => new File([new Uint8Array(10)], "scan.pdf", { type: "application/pdf" });
const OUTLINE = "## Week 1: Cells\n- Cell membrane\n- Organelles\n## Week 2: Genetics\n- DNA replication";
const OUT = (over: object = {}) => ({ isCourseMaterial: true, reason: "", prerequisites: [], units: [{ name: "Sampling", concepts: [{ name: "Standard error", short: "Std. error", desc: "How much a statistic moves." }, { name: "Central limit theorem", short: "CLT", desc: "Means look normal." }] }], ...over });

beforeEach(() => {
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  (globalThis as { __proveitMaterials?: unknown }).__proveitMaterials = undefined;
  (globalThis as { __proveitJobs?: unknown }).__proveitJobs = undefined;
  ai.on = false;
  generateText.mockReset();
  pending.length = 0;
});

describe("POST /api/courses/upload, validation", () => {
  it("rejects a missing name, missing rights, no files and unsupported types, before starting anything", async () => {
    expect((await send({ rights: "1" }, [md(OUTLINE)])).status).toBe(400);
    expect((await send({ name: "Bio" }, [md(OUTLINE)])).status).toBe(400);
    expect((await send({ name: "Bio", rights: "1" })).status).toBe(400);
    expect((await send({ name: "Bio", rights: "1" }, [new File(["x"], "deck.pptx", { type: "application/vnd.ms-powerpoint" })])).status).toBe(400);
    expect(pending).toHaveLength(0);
  });

  it("refuses images with 501 when no model key is set, since only scans and images need the model", async () => {
    const res = await send({ name: "Bio", rights: "1" }, [new File([new Uint8Array(10)], "slide.png", { type: "image/png" })]);
    expect(res.status).toBe(501);
    expect(pending).toHaveLength(0);
  });
});

describe("a course build", () => {
  it("answers at once with a job id, then builds a viewable course from a Markdown outline with no model key", async () => {
    const job = await build({ name: "Biology 101", rights: "1" }, [md(OUTLINE)]);
    expect(job).toMatchObject({ stage: "done", courseId: "biology-101", concepts: 3 });
    expect(job.stages.map((s) => s.state)).toEqual(["done", "done", "done", "done"]);
    const c = getCourse(job.courseId!);
    expect(c.concepts.map((x) => [x.name, x.unit, x.state])).toEqual([["Cell membrane", "01 CELLS", "not_started"], ["Organelles", "01 CELLS", "not_started"], ["DNA replication", "02 GENETICS", "not_started"]]);
    expect(getFiles(job.courseId!).files[0]).toMatchObject({ name: "outline.md", kind: "Notes, uploaded" });
    expect(getSidebar().courses.some((x) => x.id === job.courseId)).toBe(true);
  });

  it("reads a typeset PDF on this machine, with no model call at all", async () => {
    const job = await build({ name: "Week 3", rights: "1" }, [realPdf()]);
    // No key, so the outline comes from headings and bullets. The point is that reading needed no model.
    expect(generateText).not.toHaveBeenCalled();
    expect(job.files).toEqual([expect.objectContaining({ name: "week3-notes.pdf", state: "done", note: expect.stringMatching(/words/) })]);
    expect(job.stage).toBe("failed");
    expect(job.error).toMatch(/No concepts found/);
  });

  it("with a key, gives the model the extracted text and not the PDF, and saves the text as course files", async () => {
    ai.on = true;
    generateText.mockResolvedValueOnce({ output: OUT() });
    const job = await build({ name: "Stats", rights: "1" }, [realPdf()]);
    expect(job).toMatchObject({ stage: "done", concepts: 2 });
    expect(generateText).toHaveBeenCalledTimes(1);
    const content = generateText.mock.calls[0]![0].messages[0].content as { type: string; text?: string }[];
    expect(content.every((p) => p.type === "text")).toBe(true);
    expect(content.map((p) => p.text).join("\n")).toContain("standard error");
    const { listMaterials } = await import("@proveit/server/materials");
    expect(listMaterials(job.courseId!)[0]).toMatchObject({ name: "week3-notes.pdf", readBy: "text" });
  });

  it("falls back to the model for a file with no text layer, and says so per file", async () => {
    ai.on = true;
    generateText.mockResolvedValueOnce({ text: "Transcribed: the standard error shrinks as n grows." }).mockResolvedValueOnce({ output: OUT() });
    const job = await build({ name: "Scanned", rights: "1" }, [fakePdf()]);
    expect(job.files[0]).toMatchObject({ state: "done", note: "Read by the AI" });
    expect(job.stage).toBe("done");
  });

  it("keeps going when one file can't be read, and tells the student which", async () => {
    const job = await build({ name: "Mixed", rights: "1" }, [md(OUTLINE), fakePdf()]);
    expect(job.stage).toBe("done");
    expect(job.files.map((f) => f.state)).toEqual(["done", "failed"]);
    expect(job.files[1]!.note).toMatch(/no AI key/);
  });

  it("fails clearly when nothing could be read, and names the stage it stopped in", async () => {
    const job = await build({ name: "Bad", rights: "1" }, [fakePdf()]);
    expect(job.stage).toBe("failed");
    expect(job.error).toMatch(/no AI key/);
    expect(job.stages.map((s) => s.state)).toEqual(["failed", "waiting", "waiting", "waiting"]);
  });

  it("says why when an outline has no concepts, and why when the files aren't course material", async () => {
    expect((await build({ name: "Bio", rights: "1" }, [md("Just prose, no headings or bullets.")])).error).toMatch(/No concepts found/);
    ai.on = true;
    generateText.mockResolvedValueOnce({ output: OUT({ isCourseMaterial: false, reason: "This is a grocery receipt.", units: [] }) });
    const job = await build({ name: "Bio2", rights: "1" }, [md(OUTLINE)]);
    expect(job).toMatchObject({ stage: "failed", error: "This is a grocery receipt." });
    expect(job.stages.map((s) => s.state)).toEqual(["done", "failed", "waiting", "waiting"]);
  });

  it("with a key, keeps only prerequisites that point forward between real concepts", async () => {
    ai.on = true;
    generateText.mockResolvedValueOnce({ output: OUT({
      units: [{ name: "Sampling", concepts: [{ name: "Sampling variability", short: "Variability", desc: "Explain why statistics vary." }] }, { name: "Inference", concepts: [{ name: "Standard error", short: "Std. error", desc: "Compute SE." }, { name: "Margin of error", short: "Margin", desc: "Find the margin." }] }],
      prerequisites: [{ from: "Sampling variability", to: "Standard error" }, { from: "Standard error", to: "Margin of error" }, { from: "Margin of error", to: "Sampling variability" }, { from: "Made up", to: "Standard error" }, { from: "Standard error", to: "Standard error" }],
    }) });
    const job = await build({ name: "Stats2", rights: "1" }, [md(OUTLINE)]);
    const c = getCourse(job.courseId!);
    const id = (n: string) => c.concepts.find((x) => x.name === n)!.id;
    expect(c.edges).toEqual([[id("Sampling variability"), id("Standard error")], [id("Standard error"), id("Margin of error")]]);
  });

  it("gives a second course with the same name its own id, and adds no rank points", async () => {
    const before = getRewards().points;
    const a = await build({ name: "Bio", rights: "1" }, [md(OUTLINE)]);
    const b = await build({ name: "Bio", rights: "1" }, [md(OUTLINE)]);
    expect([a.courseId, b.courseId]).toEqual(["bio", "bio-2"]);
    expect(getRewards().points).toBe(before);
  });

  it("turns a stalled model call into a message instead of waiting forever", async () => {
    ai.on = true;
    generateText.mockRejectedValueOnce(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    const job = await build({ name: "Slow", rights: "1" }, [md(OUTLINE)]);
    expect(job.error).toMatch(/took too long/);
  });
});
