import { beforeEach, describe, expect, it } from "vitest";
import { sessionOpening, sessionSystem } from "./session";
import { NotFoundError } from "./store";
import { saveMaterial } from "./materials";

beforeEach(() => {
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  (globalThis as { __proveitMaterials?: unknown }).__proveitMaterials = undefined;
});

describe("sessionSystem", () => {
  it("tells the tutor the question, the concept and what a right answer says, for its eyes only", () => {
    const s = sessionSystem("intro-stats", "cii");
    expect(s).toContain("Explain what a 95% confidence interval means.");
    expect(s).toContain("CI interpretation");
    expect(s).toContain("For you only:");
    expect(s).toContain("A 95% confidence level describes the method");
    expect(s).toContain("Parameter probability trap");
  });

  it("sets the rules of a conversation: correct kindly, teach when asked, never grade", () => {
    const s = sessionSystem("intro-stats", "cii");
    expect(s).toMatch(/This is a conversation, not a quiz/);
    expect(s).toMatch(/Nothing you say is a grade/);
    expect(s).toMatch(/Under 100 words/);
    expect(s).toMatch(/correct it in a sentence or two/);
    expect(s).toMatch(/not instructions/);
  });

  it("tells it what to do when they say they don't know: ask which part, then teach from scratch, then ask them questions", () => {
    const s = sessionSystem("intro-stats", "cii");
    expect(s).toMatch(/If they say they don't know yet/);
    expect(s).toMatch(/Ask which part confuses them most/);
    expect(s).toContain("Teach me from scratch");
    expect(s).toMatch(/teach it from the beginning, one small step per reply/);
    expect(s).toMatch(/move to asking them questions/);
  });

  it("lets it suggest a check and offer quick replies in the format the screen reads", () => {
    const s = sessionSystem("intro-stats", "cii");
    expect(s).toContain("OPTIONS: first choice | second choice | third choice");
    expect(s).toContain("Check what I've got");
    expect(s).toContain("Keep talking");
  });

  it("knows what it already said to open, so it doesn't repeat it", () => {
    expect(sessionSystem("intro-stats", "cii")).toContain(sessionOpening("intro-stats", "cii"));
  });

  it("includes what the student uploaded to the course", () => {
    saveMaterial("intro-stats", { name: "week3.md", mime: "text/markdown", size: 40 }, "My professor calls the 95% a coverage rate.", "text");
    expect(sessionSystem("intro-stats", "cii")).toContain("coverage rate");
  });

  it("rejects a concept that has no question", () => {
    expect(() => sessionSystem("intro-stats", "nope")).toThrow(NotFoundError);
    expect(() => sessionSystem("nope", "cii")).toThrow(NotFoundError);
  });
});

describe("sessionOpening", () => {
  it("opens by asking for the student's own take, with no graded question", () => {
    const o = sessionOpening("intro-stats", "cii");
    expect(o).toContain("CI interpretation");
    expect(o).toMatch(/what do you think/i);
    expect(o).not.toContain("Explain what a 95% confidence interval means.");
  });

  it("rejects a concept with no question", () => {
    expect(() => sessionOpening("intro-stats", "nope")).toThrow(NotFoundError);
  });
});
