import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
let ai = false;
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a), Output: { object: (o: unknown) => o } }));
vi.mock("./ai", () => ({ aiEnabled: () => ai, model: () => "mock-model" }));
const compile = vi.fn();
vi.mock("./latex", async (orig) => ({ ...(await orig<typeof import("./latex")>()), compile: (...a: unknown[]) => compile(...a) }));

import { getWeakness, samplePaper, studyNotes } from "./practice";
import { esc } from "./latex";

beforeEach(() => { generateText.mockReset(); compile.mockReset(); ai = false; compile.mockResolvedValue(Buffer.from("%PDF")); });

describe("getWeakness", () => {
  it("flags needs-work concepts and attaches the open mistake with its fix", () => {
    const w = getWeakness("intro-stats");
    const cii = w.concepts.find((c) => c.id === "cii")!;
    expect(cii.weak).toBe(true);
    expect(cii.mistakes[0]).toMatchObject({ name: expect.any(String), gap: expect.any(String) });
    expect(w.concepts.some((c) => !c.weak)).toBe(true);
  });
});

describe("samplePaper", () => {
  it("offline, returns a paper and a separate key with one answer per question", async () => {
    const r = await samplePaper("intro-stats");
    expect(r.docs.map((d) => d.name)).toEqual(["question-paper", "answer-key"]);
    expect(r.docs.every((d) => d.pdf === Buffer.from("%PDF").toString("base64"))).toBe(true);
    const qs = (r.docs[0]!.tex.match(/\\item\[\\textbf\{Q\d+\./g) ?? []).length;
    expect(qs).toBe(10);
    expect((r.docs[1]!.tex.match(/\\textbf\{Answer\.\}/g) ?? []).length).toBe(qs);
    expect(r.docs[0]!.tex).not.toContain("Answer.");
    expect(r.pdfError).toBeNull();
  });

  it("puts the weak concept first and asks it twice", async () => {
    const tex = (await samplePaper("intro-stats")).docs[0]!.tex;
    expect((tex.match(/95\\% confidence interval/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("returns the .tex and an error when the compile fails", async () => {
    compile.mockRejectedValue(Object.assign(new Error("x"), { code: "ENOENT" }));
    const r = await samplePaper("intro-stats");
    expect(r.docs.every((d) => d.pdf === null && d.tex.includes("\\begin{document}"))).toBe(true);
    expect(r.pdfError).toContain("tectonic");
  });

  it("with a model, rejects a key that doesn't match the questions", async () => {
    ai = true;
    generateText.mockResolvedValue({ output: { questions: [{ concept: "a", prompt: "p", marks: 5 }], key: [] } });
    await expect(samplePaper("intro-stats")).rejects.toThrow(/key/);
  });
});

describe("paper and notes are written in parallel parts", () => {
  it("splits the questions between two calls with no concept in both, and joins them in one paper", async () => {
    ai = true;
    generateText.mockImplementation(async ({ prompt }: { prompt: string }) => {
      const concepts = JSON.parse(prompt).concepts as { name: string; questions: number }[];
      const qs = concepts.flatMap((c) => Array.from({ length: c.questions }, (_, k) => ({ concept: c.name, prompt: `${c.name} Q${k}?`, marks: 5 })));
      return { output: { questions: qs, key: qs.map((q) => ({ answer: `Answer to ${q.prompt}`, marking: "One mark." })) } };
    });
    const r = await samplePaper("intro-stats");
    expect(generateText).toHaveBeenCalledTimes(2);
    const [a, b] = generateText.mock.calls.map((c) => (JSON.parse(c[0].prompt).concepts as { name: string }[]).map((x) => x.name));
    expect(a!.filter((n) => b!.includes(n))).toEqual([]);
    expect((r.docs[0]!.tex.match(/\\item\[\\textbf\{Q\d+\./g) ?? []).length).toBe(10);
    expect((r.docs[1]!.tex.match(/Answer to /g) ?? []).length).toBe(10);
  });

  it("splits the notes into parts and keeps every concept, in the course's order", async () => {
    ai = true;
    generateText.mockImplementation(async ({ prompt }: { prompt: string }) => ({ output: { sections: (JSON.parse(prompt).concepts as { name: string }[]).map((c) => ({ concept: c.name, summary: `About ${c.name}.`, points: [] })) } }));
    const tex = (await studyNotes("intro-stats")).docs[0]!.tex;
    expect(generateText.mock.calls.length).toBeGreaterThan(1);
    const names = getWeakness("intro-stats").concepts.map((c) => c.name);
    for (const n of names) expect(tex).toContain(`About ${n}.`);
  });
});

describe("studyNotes", () => {
  it("lists the open mistake with what the student said and how to fix it", async () => {
    const tex = (await studyNotes("intro-stats")).docs[0]!.tex;
    expect(tex).toContain("What you keep getting wrong");
    expect(tex).toContain("How to fix it.");
  });

  it("with a model, keeps the course's concept order and falls back for concepts the model skipped", async () => {
    ai = true;
    // The notes are written in parallel parts, so each call answers only for the concepts it was given.
    generateText.mockImplementation(async ({ prompt }: { prompt: string }) => ({ output: { sections: JSON.parse(prompt).concepts.filter((c: { name: string }) => c.name === "CI interpretation").map(() => ({ concept: "CI interpretation", summary: "From the model.", points: ["p1"] })) } }));
    const tex = (await studyNotes("intro-stats")).docs[0]!.tex;
    expect(tex).toContain("From the model.");
    expect(tex.indexOf("CI interpretation")).toBeGreaterThan(-1);
    expect(tex).toContain("Standard error");
  });
});

describe("esc quotes", () => {
  it("opens and closes straight quotes the way LaTeX expects", () => {
    expect(esc('Say "ma" and \'hao\' now')).toBe("Say ``ma'' and `hao' now");
    expect(esc('"Start" (the "end")')).toBe("``Start'' (the ``end'')");
  });
});

describe("esc", () => {
  it("neutralises LaTeX control characters", () => {
    expect(esc("\\input{/etc/passwd} 50% & $x_1$ #a ~ ^")).toBe("\\textbackslash{}input\\{/etc/passwd\\} 50\\% \\& \\$x\\_1\\$ \\#a \\textasciitilde{} \\textasciicircum{}");
  });
});
