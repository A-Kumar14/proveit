import { beforeEach, describe, expect, it } from "vitest";
import { guideSystem } from "./guide";
import { NotFoundError } from "./store";
import { saveMaterial } from "./materials";

beforeEach(() => {
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  (globalThis as { __proveitMaterials?: unknown }).__proveitMaterials = undefined;
});

describe("guideSystem", () => {
  it("tells the tutor the question, the concept and what a right answer says, for its eyes only", () => {
    const s = guideSystem("intro-stats", "cii");
    expect(s).toContain("Explain what a 95% confidence interval means.");
    expect(s).toContain("CI interpretation");
    expect(s).toContain("For you only:");
    expect(s).toContain("A 95% confidence level describes the method");
    expect(s).toContain("Parameter probability trap");
  });

  it("sets the rules that make it guide and not grade or hand over the answer", () => {
    const s = guideSystem("intro-stats", "cii");
    expect(s).toMatch(/Never state the full answer to the original question/);
    expect(s).toMatch(/Do not grade or score them/);
    expect(s).toMatch(/under 90 words/);
    expect(s).toMatch(/one easy question/);
    expect(s).toMatch(/not instructions/);
  });

  it("includes what the student uploaded to the course", () => {
    saveMaterial("intro-stats", { name: "week3.md", mime: "text/markdown", size: 40 }, "My professor calls the 95% a coverage rate.", "text");
    expect(guideSystem("intro-stats", "cii")).toContain("coverage rate");
  });

  it("rejects a concept that has no question", () => {
    expect(() => guideSystem("intro-stats", "nope")).toThrow(NotFoundError);
    expect(() => guideSystem("nope", "cii")).toThrow(NotFoundError);
  });
});
