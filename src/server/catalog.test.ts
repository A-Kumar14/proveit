import { describe, expect, it } from "vitest";
import { catalogEntry, catalogSpecs, getCatalogSpec, parseCourseMd } from "./catalog";

describe("parseCourseMd", () => {
  const md = `---\ntitle: Test Course\ntopic: Testing\nlevel: Advanced\nsummary: A course.\n---\n# Test Course\nIntro text.\n\n## Unit A\n### One\nFirst fact. More detail here.\n\n### Two\nSecond fact.\n\n## Unit B\n### Three\nThird fact.\n`;

  it("reads front matter, units and concepts, and takes the first sentence as the description", () => {
    const s = parseCourseMd(md, "x", "upload", "test-course")!;
    expect(s).toMatchObject({ id: "test-course", name: "Test Course", topic: "Testing", level: "Advanced", summary: "A course.", source: "upload" });
    expect(s.units.map((u) => [u.name, u.concepts.map((c) => c.name)])).toEqual([["Unit A", ["One", "Two"]], ["Unit B", ["Three"]]]);
    expect(s.units[0]!.concepts[0]!.desc).toBe("First fact.");
    expect(s.material).toContain("Second fact.");
    expect(s.material).not.toContain("title:");
  });

  it("treats a file with only ## headings as one unit of concepts", () => {
    const s = parseCourseMd("# Notes\n## Alpha\nA body.\n## Beta\nB body.\n", "Notes", "upload")!;
    expect(s.id).toBe("notes");
    expect(s.units).toHaveLength(1);
    expect(s.units[0]!.concepts.map((c) => c.name)).toEqual(["Alpha", "Beta"]);
  });

  it("skips headings with no text and returns null when nothing is left", () => {
    expect(parseCourseMd("## U\n### Empty\n\n### Real\nText.\n", "x", "upload")!.units[0]!.concepts.map((c) => c.name)).toEqual(["Real"]);
    expect(parseCourseMd("just some text", "x", "upload")).toBeNull();
    expect(parseCourseMd("## U\n### Empty\n", "x", "upload")).toBeNull();
  });

  it("handles Windows line endings", () => {
    expect(parseCourseMd("## U\r\n### A\r\nFact.\r\n", "x", "upload")!.units[0]!.concepts[0]!.desc).toBe("Fact.");
  });
});

describe("curated catalog", () => {
  it("ships five courses that all parse into units and concepts", () => {
    const all = catalogSpecs();
    expect(all.map((s) => s.id).sort()).toEqual(["accounting-101", "chinese-101", "intro-computer-science", "network-management", "personal-finance-101"]);
    for (const s of all) {
      const e = catalogEntry(s);
      expect(e.concepts).toBeGreaterThanOrEqual(8);
      expect(e.units).toBeGreaterThanOrEqual(3);
      expect(s.units.every((u) => u.concepts.every((c) => c.desc.length > 20))).toBe(true);
      expect(s.material.length).toBeGreaterThan(1500);
    }
    expect(getCatalogSpec("chinese-101")!.name).toBe("Chinese 101");
    expect(getCatalogSpec("nope")).toBeNull();
  });
});
