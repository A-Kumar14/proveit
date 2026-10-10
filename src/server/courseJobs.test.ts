import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./ai", () => ({ aiEnabled: () => false, model: () => "mock-model" }));

import { cancelJob, createJob, getJob, runCourseJob, STAGES, type JobInput } from "./courseJobs";
import { getSidebar } from "./store";
import { runAsUser } from "./userScope";

const input = (name: string, text: string): JobInput => ({ name, type: "text/markdown", size: text.length, bytes: new TextEncoder().encode(text) });
const MD = "## Unit\n- One idea\n- Two ideas\n- Three ideas";

beforeEach(() => {
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  (globalThis as { __proveitMaterials?: unknown }).__proveitMaterials = undefined;
  (globalThis as { __proveitJobs?: unknown }).__proveitJobs = undefined;
});

describe("course jobs belong to one user", () => {
  it("hides a job from other users, who also can't cancel it", () => {
    const id = runAsUser("user_a", () => createJob("Bio", [input("a.md", MD)]));
    expect(runAsUser("user_a", () => getJob(id))).toMatchObject({ stage: "reading" });
    expect(runAsUser("user_b", () => getJob(id))).toBeNull();
    expect(runAsUser("user_b", () => cancelJob(id))).toBe(false);
    expect(runAsUser("user_a", () => getJob(id))!.stage).toBe("reading");
  });

  it("builds the course in its owner's space, not anyone else's", async () => {
    const inputs = [input("a.md", MD)];
    const id = runAsUser("user_a", () => createJob("Bio", inputs));
    await runCourseJob(id, inputs);
    expect(runAsUser("user_a", () => getSidebar().courses.some((c) => c.id === "bio"))).toBe(true);
    expect(runAsUser("user_b", () => getSidebar().courses.some((c) => c.id === "bio"))).toBe(false);
  });
});

describe("course jobs", () => {
  it("lists the four stages the student sees, in order", () => {
    expect(STAGES.map((s) => s.label)).toEqual(["Reading your files", "Finding the topics", "Building the concept map", "Saving your notes for the tutor"]);
  });

  it("starts in the first stage with every file waiting, and knows nothing about an unknown id", () => {
    const id = createJob("Bio", [input("a.md", MD), input("b.md", MD)]);
    expect(getJob(id)).toMatchObject({ stage: "reading", files: [{ name: "a.md", state: "waiting" }, { name: "b.md", state: "waiting" }] });
    expect(getJob(id)!.stages.map((s) => s.state)).toEqual(["active", "waiting", "waiting", "waiting"]);
    expect(getJob("nope")).toBeNull();
  });

  it("runs to done and reports the course it made", async () => {
    const inputs = [input("a.md", MD)];
    const id = createJob("Bio", inputs);
    await runCourseJob(id, inputs);
    const j = getJob(id)!;
    expect(j).toMatchObject({ stage: "done", courseId: "bio", concepts: 3 });
    expect(getSidebar().courses.some((c) => c.id === "bio")).toBe(true);
  });

  it("stops without making a course when cancelled before it starts", async () => {
    const inputs = [input("a.md", MD)];
    const id = createJob("Bio", inputs);
    expect(cancelJob(id)).toBe(true);
    await runCourseJob(id, inputs);
    expect(getJob(id)).toMatchObject({ stage: "cancelled" });
    expect(getSidebar().courses.some((c) => c.id === "bio")).toBe(false);
    expect(cancelJob(id)).toBe(false);
  });

  it("can't cancel a build that has finished", async () => {
    const inputs = [input("a.md", MD)];
    const id = createJob("Bio", inputs);
    await runCourseJob(id, inputs);
    expect(cancelJob(id)).toBe(false);
    expect(getJob(id)!.stage).toBe("done");
  });

  it("reports a build that went quiet as failed, so the loader can't spin forever", () => {
    const id = createJob("Bio", [input("a.md", MD)]);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 7 * 60 * 1000);
    const j = getJob(id)!;
    vi.useRealTimers();
    expect(j.stage).toBe("failed");
    expect(j.error).toMatch(/server restarted/);
    expect(j.stages[0]!.state).toBe("failed");
  });
});
