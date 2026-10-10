import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ generateText: vi.fn(), enabled: true }));
const generateText = mocked.generateText;
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a), Output: { object: (o: unknown) => o } }));
vi.mock("./ai", () => ({ aiEnabled: () => mocked.enabled, model: () => "mock-model" }));

import { getAuthoredLearningSpec } from "./authoredLearningSpecs";
import {
  judgeAnswer,
  judgeReview,
  judgeSpecAnswer,
  judgeSpecReview,
  judgeSpecTransfer,
  judgeTransfer,
  LearningSpecEvaluationError,
} from "./evaluator";

const ANSWER = "It means there's a 95% probability that the true population mean is inside our interval.";
const reply = (...outputs: object[]) => outputs.forEach((output) => generateText.mockResolvedValueOnce({ output }));
const bad = { verdict: "incorrect", misconceptionId: "parameter_probability_trap", evidenceQuote: "a 95% probability that the true population mean is inside" };
const transferPass = { verdict: "pass", misconceptionId: null, evidenceQuote: null, feedback: null };
const transferUncertain = { verdict: "uncertain", misconceptionId: null, evidenceQuote: null, feedback: "Address both parts." };
const transferBad = { verdict: "fail", misconceptionId: "parameter_probability_trap", evidenceQuote: "95% chance", feedback: "Don't assign probability to one realized interval." };

beforeEach(() => {
  mocked.enabled = true;
  generateText.mockReset();
});

describe("judgeAnswer with Gemini", () => {
  it("returns the majority verdict, diagnosis vote count and an exact quote", async () => {
    reply(bad, bad, { verdict: "uncertain", misconceptionId: null, evidenceQuote: null });
    const j = await judgeAnswer("cii", ANSWER);
    expect(j).toMatchObject({ verdict: "incorrect", misconceptionId: "parameter_probability_trap", votes: { agree: 2, of: 3 } });
    expect(ANSWER.includes(j.quote!)).toBe(true);
  });

  it("drops a quote the model made up", async () => {
    reply({ ...bad, evidenceQuote: "not in the answer" }, bad, bad);
    expect((await judgeAnswer("cii", ANSWER)).quote).toBe(bad.evidenceQuote);
    generateText.mockReset();
    reply({ ...bad, evidenceQuote: "made up" }, { ...bad, evidenceQuote: "made up" }, { ...bad, evidenceQuote: "made up" });
    expect((await judgeAnswer("cii", ANSWER)).quote).toBeNull();
  });

  it("calls a three-way split uncertain instead of guessing", async () => {
    reply(bad, { verdict: "correct", misconceptionId: null, evidenceQuote: null }, { verdict: "uncertain", misconceptionId: null, evidenceQuote: null });
    expect(await judgeAnswer("cii", ANSWER)).toMatchObject({ verdict: "uncertain", quote: null, misconceptionId: null });
  });

  it("refuses to diagnose a misconception id that is not authored", async () => {
    const invented = { verdict: "incorrect", misconceptionId: "made_up_misconception", evidenceQuote: bad.evidenceQuote };
    reply(invented, invented, { verdict: "uncertain", misconceptionId: null, evidenceQuote: null });
    expect(await judgeAnswer("cii", ANSWER)).toMatchObject({ verdict: "uncertain", misconceptionId: null, quote: null });
  });

  it("requires a majority to agree on the diagnosis, not only on incorrect", async () => {
    reply(bad, { ...bad, misconceptionId: null }, { verdict: "uncertain", misconceptionId: null, evidenceQuote: null });
    expect(await judgeAnswer("cii", ANSWER)).toMatchObject({ verdict: "uncertain", misconceptionId: null });
  });

  it("includes earlier episode evidence and the actual follow-up prompt when judging a clarification", async () => {
    const correct = { verdict: "correct", misconceptionId: null, evidenceQuote: null };
    reply(correct, correct, correct);
    await judgeAnswer("cii", "I meant the long-run method, not this one interval.", {
      previous: [{ answer: ANSWER, verdict: "incorrect", misconceptionId: "parameter_probability_trap" }],
      followUpPrompt: "Did you mean the method or this one interval?",
    });
    const prompt = generateText.mock.calls[0]?.[0]?.prompt as string;
    expect(prompt).toContain(ANSWER);
    expect(prompt).toContain("Did you mean the method or this one interval?");
    expect(prompt).toContain("CURRENT student answer");
    expect(prompt).toContain("I meant the long-run method");
  });

  it("uses a low deterministic temperature for grading", async () => {
    const correct = { verdict: "correct", misconceptionId: null, evidenceQuote: null };
    reply(correct, correct, correct);
    await judgeAnswer("cii", "Repeated methods give about 95% coverage.");
    expect(generateText.mock.calls.every((c) => c[0].temperature === 0.2)).toBe(true);
  });

  it("surfaces model failures so the UI can offer a retry", async () => {
    generateText.mockResolvedValue({ get output(): never { throw new Error("quota"); } });
    const err = await judgeAnswer("cii", ANSWER).then(() => null, (e: Error) => e);
    expect(err?.message).toBe("quota");
  });
});

describe("judgeTransfer with Gemini", () => {
  it("requires a majority pass and returns structured evidence", async () => {
    reply(transferPass, transferUncertain, transferPass);
    expect(await judgeTransfer("cii", "x")).toMatchObject({ verdict: "pass", misconceptionId: null, votes: { agree: 2, of: 3 } });
  });

  it("returns a known misconception only when a majority agrees on it", async () => {
    reply(transferBad, transferBad, transferUncertain);
    expect(await judgeTransfer("cii", "95% chance")).toMatchObject({ verdict: "fail", misconceptionId: "parameter_probability_trap", quote: "95% chance", votes: { agree: 2, of: 3 } });
  });

  it("keeps a clear fail but drops an invented diagnosis", async () => {
    const invented = { ...transferBad, misconceptionId: "invented" };
    reply(invented, invented, transferUncertain);
    expect(await judgeTransfer("cii", "95% chance")).toMatchObject({ verdict: "fail", misconceptionId: null, quote: null, votes: { agree: 2, of: 3 } });
  });

  it("returns uncertain on a three-way split", async () => {
    reply(transferPass, transferBad, transferUncertain);
    expect(await judgeTransfer("cii", "x")).toMatchObject({ verdict: "uncertain", misconceptionId: null });
  });
});


describe("judgeReview with Gemini", () => {
  it("uses the delayed-review rubric rather than replaying the transfer prompt", async () => {
    reply(transferPass, transferPass, transferUncertain);
    const result = await judgeReview("cii", "The report is invalid; 95% is the long-run method.");
    expect(result).toMatchObject({ verdict: "pass", votes: { agree: 2, of: 3 } });
    const prompt = generateText.mock.calls[0]?.[0]?.prompt as string;
    expect(prompt).toContain("Delayed review question");
    expect(prompt).toContain("A report says");
    expect(prompt).not.toContain("100 researchers");
  });

  it("will not attach an invented misconception to a delayed-review failure", async () => {
    const invented = { verdict: "fail", misconceptionId: "invented", evidenceQuote: "95% chance", feedback: "Nope." };
    reply(invented, invented, transferUncertain);
    expect(await judgeReview("cii", "95% chance")).toMatchObject({ verdict: "fail", misconceptionId: null, quote: null });
  });
});


describe("canonical ConceptLearningSpec evaluation", () => {
  const generatedSpec = () => {
    const spec = getAuthoredLearningSpec("intro-stats", "cii")!;
    const sourceId = "source-1";
    spec.courseId = "private-stats";
    spec.conceptId = "private-ci";
    spec.provenance = { kind: "generated", model: "test-generator", generatedAt: "2026-10-10T00:00:00Z" };
    spec.sources = [{
      id: sourceId,
      kind: "material_excerpt",
      materialId: "notes-1",
      title: "Week 4 notes",
      locator: "characters 1-200",
      excerpt: "Across repeated samples, about 95% of intervals made by the method contain the fixed population mean.",
    }];
    spec.assessment.sourceIds = [sourceId];
    spec.misconceptions.forEach((m) => { m.sourceIds = [sourceId]; });
    spec.remediations.forEach((r) => { r.sourceIds = [sourceId]; r.figure = null; });
    spec.transfer.sourceIds = [sourceId];
    spec.review.sourceIds = [sourceId];
    return spec;
  };

  it("grades a generated assessment from its spec and exact source excerpt", async () => {
    const correct = { verdict: "correct", misconceptionId: null, evidenceQuote: null };
    reply(correct, correct, { verdict: "uncertain", misconceptionId: null, evidenceQuote: null });

    const spec = generatedSpec();
    const result = await judgeSpecAnswer(spec, "The 95% is long-run coverage across repeated samples.");

    expect(result).toMatchObject({ verdict: "correct", votes: { agree: 2, of: 3 } });
    const prompt = generateText.mock.calls[0]?.[0]?.prompt as string;
    expect(prompt).toContain(spec.assessment.rubric);
    expect(prompt).toContain("Week 4 notes");
    expect(prompt).toContain("Across repeated samples, about 95% of intervals");
    expect(prompt).toContain("private-ci");
  });

  it("accepts only misconception ids declared by a generated spec", async () => {
    const invented = {
      verdict: "incorrect",
      misconceptionId: "invented",
      evidenceQuote: "95% probability",
    };
    reply(invented, invented, { verdict: "uncertain", misconceptionId: null, evidenceQuote: null });

    expect(await judgeSpecAnswer(generatedSpec(), "It is a 95% probability.")).toMatchObject({
      verdict: "uncertain",
      misconceptionId: null,
      quote: null,
    });
  });

  it("uses the generated transfer and delayed-review rubrics", async () => {
    reply(transferPass, transferPass, transferUncertain);
    const spec = generatedSpec();
    await judgeSpecTransfer(spec, "About 95 of 100; one realized interval either contains the mean or not.");
    const transferPrompt = generateText.mock.calls[0]?.[0]?.prompt as string;
    expect(transferPrompt).toContain(spec.transfer.rubric);
    expect(transferPrompt).toContain("Transfer question");

    generateText.mockReset();
    reply(transferPass, transferPass, transferUncertain);
    await judgeSpecReview(spec, "The claim is invalid; 95% refers to repeated-method coverage.");
    const reviewPrompt = generateText.mock.calls[0]?.[0]?.prompt as string;
    expect(reviewPrompt).toContain(spec.review.rubric);
    expect(reviewPrompt).toContain("Delayed review question");
  });

  it("fails closed for generated content when no AI evaluator is configured", async () => {
    mocked.enabled = false;
    const spec = generatedSpec();

    await expect(judgeSpecAnswer(spec, "answer")).rejects.toBeInstanceOf(LearningSpecEvaluationError);
    await expect(judgeSpecTransfer(spec, "answer")).rejects.toThrow(/requires an AI key/i);
    await expect(judgeSpecReview(spec, "answer")).rejects.toThrow(/requires an AI key/i);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("preserves deterministic offline graders for authored gold fixtures", async () => {
    mocked.enabled = false;
    const spec = getAuthoredLearningSpec("intro-stats", "cii")!;

    expect(await judgeSpecAnswer(spec, "Across repeated samples about 95% of intervals from the method contain the mean."))
      .toMatchObject({ verdict: "correct", votes: null });
    expect(generateText).not.toHaveBeenCalled();
  });
});
