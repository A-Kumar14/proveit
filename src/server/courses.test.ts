import { beforeEach, describe, expect, it } from "vitest";
import { addCatalogCourse, browseCatalog, removeCatalogCourse } from "./courses";
import { addMaterial, listMaterials } from "./materials";
import { courseSpec, createCourse, getCourse, getSidebar, getTodos, listCourses, NotFoundError } from "./store";

beforeEach(() => {
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  (globalThis as { __proveitMaterials?: unknown }).__proveitMaterials = undefined;
});

describe("curated courses", () => {
  it("lists five courses, none added yet", () => {
    const items = browseCatalog();
    expect(items).toHaveLength(5);
    expect(items.every((i) => !i.added)).toBe(true);
  });

  it("adds a course to In progress, once", () => {
    expect(addCatalogCourse("chinese-101")).toEqual({ id: "chinese-101", added: true });
    expect(addCatalogCourse("chinese-101")).toEqual({ id: "chinese-101", added: false });
    expect(browseCatalog().find((i) => i.id === "chinese-101")!.added).toBe(true);
    const row = getSidebar().courses.find((c) => c.id === "chinese-101")!;
    expect(row).toMatchObject({ name: "Chinese 101", completed: false });
    expect(listCourses().filter((c) => c.id === "chinese-101")).toHaveLength(1);
  });

  it("builds a map from the notes, with every concept not started and a way to study it", () => {
    addCatalogCourse("personal-finance-101");
    const c = getCourse("personal-finance-101");
    expect(c.concepts.length).toBeGreaterThanOrEqual(8);
    expect(c.concepts.every((x) => x.state === "not_started")).toBe(true);
    expect(c.concepts[0]!.cta).toEqual({ label: "Study with the tutor", href: "/course/personal-finance-101/tutor" });
    expect(new Set(c.concepts.map((x) => x.id)).size).toBe(c.concepts.length);
    expect(courseSpec("personal-finance-101")!.material).toContain("emergency fund");
  });

  it("keeps added courses out of the to-do list, since they can't be practised yet", () => {
    addCatalogCourse("network-management");
    expect(getTodos().map((g) => g.courseId)).not.toContain("network-management");
  });

  it("removes only courses the student added", () => {
    addCatalogCourse("accounting-101");
    expect(removeCatalogCourse("accounting-101")).toEqual({ removed: true });
    expect(getSidebar().courses.some((c) => c.id === "accounting-101")).toBe(false);
    expect(removeCatalogCourse("intro-stats")).toEqual({ removed: false });
    expect(getSidebar().courses.some((c) => c.id === "intro-stats")).toBe(true);
  });

  it("also removes the files the course had, and any course added at runtime", async () => {
    addCatalogCourse("accounting-101");
    await addMaterial("accounting-101", new File(["Notes on ledgers."], "l.md", { type: "text/markdown" }));
    removeCatalogCourse("accounting-101");
    expect(listMaterials("accounting-101")).toEqual([]);
  });

  it("carries class-map importance into the frozen topic point allocations", () => {
    const id = createCourse({
      name: "Weighted Map",
      outline: {
        units: [{
          name: "Core",
          concepts: [
            { name: "Supporting idea", short: "Supporting", desc: "Support.", importance: 1 },
            { name: "Core idea", short: "Core", desc: "Core.", importance: 3 },
          ],
        }],
        prerequisites: [],
      },
      files: [],
      rewardSource: "weighted-map-source",
    });
    const byName = Object.fromEntries(getCourse(id).concepts.map((concept) => [concept.name, concept]));
    expect(byName["Supporting idea"]!.rewards?.weight).toBe(1);
    expect(byName["Core idea"]!.rewards?.weight).toBe(3);
    expect(byName["Core idea"]!.rewards!.quiz).toBeGreaterThan(byName["Supporting idea"]!.rewards!.quiz);
    expect(byName["Core idea"]!.rewards!.explanation).toBeGreaterThan(byName["Supporting idea"]!.rewards!.explanation);
  });

  it("rejects an unknown course", () => {
    expect(() => addCatalogCourse("nope")).toThrow(NotFoundError);
  });
});
