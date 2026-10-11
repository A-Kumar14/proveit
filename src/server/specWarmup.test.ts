import { beforeEach, describe, expect, it, vi } from "vitest";

const gen = vi.hoisted(() => ({ ensure: vi.fn(async () => ({})), active: 0, peak: 0 }));
const course = vi.hoisted(() => ({ runtime: true, concepts: Array.from({ length: 10 }, (_, i) => ({ id: `c${i}` })) }));

vi.mock("./ai", () => ({ aiEnabled: () => true }));
vi.mock("./learningSpecGenerator", () => ({ ensureConceptLearningSpec: gen.ensure }));
vi.mock("./store", () => ({ getCourse: () => course, isRuntimeCourse: () => course.runtime }));
vi.mock("./userScope", () => ({ scopedUserId: () => "u1" }));

import { warmCourseSpecs } from "./specWarmup";

beforeEach(() => {
  course.runtime = true;
  gen.active = 0;
  gen.peak = 0;
  gen.ensure.mockReset();
  gen.ensure.mockImplementation(async () => {
    gen.active++;
    gen.peak = Math.max(gen.peak, gen.active);
    await new Promise((r) => setTimeout(r, 5));
    gen.active--;
    return {};
  });
});

describe("warmCourseSpecs", () => {
  it("prepares every concept, a few at a time", async () => {
    await warmCourseSpecs("c", 3);
    expect(gen.ensure).toHaveBeenCalledTimes(10);
    expect(gen.peak).toBe(3);
  });

  it("skips courses with built-in content", async () => {
    course.runtime = false;
    await warmCourseSpecs("c");
    expect(gen.ensure).not.toHaveBeenCalled();
  });

  it("keeps going when one concept fails", async () => {
    gen.ensure.mockImplementationOnce(async () => { throw new Error("model busy"); });
    await warmCourseSpecs("c");
    expect(gen.ensure).toHaveBeenCalledTimes(10);
  });

  it("doesn't start a second sweep for the same course while one is running", async () => {
    const first = warmCourseSpecs("c");
    await warmCourseSpecs("c");
    await first;
    expect(gen.ensure).toHaveBeenCalledTimes(10);
  });
});
