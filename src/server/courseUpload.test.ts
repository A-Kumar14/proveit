import { describe, expect, it } from "vitest";
import { kindOf, outlineFromText } from "./courseUpload";

describe("outlineFromText", () => {
  it("turns headings into units and bullets into concepts, with no invented prerequisites", () => {
    const o = outlineFromText(`# Biology 101

## Week 1: Cells
- Cell membrane: control what enters and leaves the cell
- Organelles
## Week 2 - Genetics
1. DNA replication
2) Mendelian inheritance`);
    expect(o.units.map((u) => u.name)).toEqual(["Cells", "Genetics"]);
    expect(o.units[0]!.concepts[0]).toMatchObject({ name: "Cell membrane", short: "Cell membrane", desc: "control what enters and leaves the cell" });
    expect(o.units[1]!.concepts.map((c) => c.name)).toEqual(["DNA replication", "Mendelian inheritance"]);
    expect(o.prerequisites).toEqual([]);
  });

  it("skips syllabus admin and caps the map at 4 units of 3 concepts", () => {
    const o = outlineFromText(`## Grading
- Homework 40%
Unit 1: Limits
- One-sided limits
- Continuity
- Squeeze theorem
- Limits at infinity
Unit 2: Derivatives
- Office hours are Tuesday
- Chain rule
Unit 3: Integrals
- Riemann sums
Unit 4: Series
- Ratio test
Unit 5: Extra
- Taylor series`);
    expect(o.units.map((u) => u.name)).toEqual(["Limits", "Derivatives", "Integrals", "Series"]);
    expect(o.units[0]!.concepts).toHaveLength(3);
    expect(o.units[1]!.concepts.map((c) => c.name)).toEqual(["Chain rule"]);
  });

  it("puts bullets with no heading in one Topics unit, and returns nothing for prose", () => {
    expect(outlineFromText("- Supply\n- Demand").units).toEqual([{ name: "Topics", concepts: expect.any(Array) }]);
    expect(outlineFromText("Just a paragraph of notes with no structure.").units).toEqual([]);
  });
});

describe("kindOf", () => {
  const f = (name: string, type: string) => new File(["x"], name, { type });
  it("accepts PDFs, images and text, using the extension when the type is missing", () => {
    expect(kindOf(f("a.pdf", "application/pdf"))).toBe("pdf");
    expect(kindOf(f("notes.md", ""))).toBe("text");
    expect(kindOf(f("notes.txt", "text/plain"))).toBe("text");
    expect(kindOf(f("slide.png", "image/png"))).toBe("image");
    expect(kindOf(f("deck.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"))).toBe("document");
    expect(kindOf(f("notes.docx", ""))).toBe("document");
    expect(kindOf(f("grades.csv", "application/vnd.ms-excel"))).toBe("document");
    expect(kindOf(f("page.html", "text/html"))).toBe("document");
    expect(kindOf(f("old.doc", "application/msword"))).toBeNull();
    expect(kindOf(f("app.exe", "application/x-msdownload"))).toBeNull();
  });
});
