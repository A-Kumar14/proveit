import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
let ai = false;
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a), Output: { object: (o: unknown) => o } }));
vi.mock("./ai", () => ({ aiEnabled: () => ai, model: () => "mock-model" }));

import { addMaterial, courseMaterial, listMaterials, MaterialError, materialKind, removeMaterial } from "./materials";
import { addCatalogCourse } from "./courses";
import { NotFoundError } from "./store";

const file = (name: string, type: string, body = "x") => new File([body], name, { type });

beforeEach(() => {
  ai = false;
  generateText.mockReset();
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  (globalThis as { __proveitMaterials?: unknown }).__proveitMaterials = undefined;
});

describe("materialKind", () => {
  it("decides text by extension, since browsers send empty types for markdown", () => {
    expect(materialKind({ name: "notes.md", type: "" })).toBe("text");
    expect(materialKind({ name: "notes.txt", type: "text/plain" })).toBe("text");
    expect(materialKind({ name: "a.pdf", type: "application/pdf" })).toBe("pdf");
    expect(materialKind({ name: "a.png", type: "image/png" })).toBe("image");
    expect(materialKind({ name: "a.exe", type: "application/x-msdownload" })).toBeNull();
  });
});

describe("course files", () => {
  it("reads a markdown file as it is and lists it for the course", async () => {
    const m = await addMaterial("intro-stats", file("week1.md", "", "# Week 1\nStandard error shrinks with n."));
    expect(m).toMatchObject({ name: "week1.md", readBy: "text", words: 8 });
    expect(listMaterials("intro-stats").map((x) => x.name)).toEqual(["week1.md"]);
    expect(listMaterials("other")).toEqual([]);
  });

  it("puts uploaded text into the course material the tutor and quiz read", async () => {
    addCatalogCourse("personal-finance-101");
    await addMaterial("personal-finance-101", file("mine.txt", "text/plain", "My landlord is called Priya."));
    const text = courseMaterial("personal-finance-101");
    expect(text).toContain("emergency fund");
    expect(text).toContain("Uploaded file: mine.txt");
    expect(text).toContain("Priya");
  });

  it("uses the authored notes for the demo course", () => {
    expect(courseMaterial("intro-stats")).toContain("95% confidence level describes the method");
  });

  it("caps the material so a prompt can't grow without limit", async () => {
    await addMaterial("intro-stats", file("big.txt", "text/plain", "word ".repeat(40_000)));
    expect(courseMaterial("intro-stats", 5_000).length).toBeLessThan(5_100);
  });

  it("has the model read a PDF, and says so when no key is set", async () => {
    await expect(addMaterial("intro-stats", file("a.pdf", "application/pdf"))).rejects.toThrow(/no AI key/);
    ai = true;
    generateText.mockResolvedValueOnce({ text: "Transcribed lecture text about sampling." });
    const m = await addMaterial("intro-stats", file("a.pdf", "application/pdf"));
    expect(m).toMatchObject({ readBy: "ai", text: "Transcribed lecture text about sampling." });
    expect(generateText.mock.calls[0]![0].messages[0].content[1]).toMatchObject({ type: "file", mediaType: "application/pdf" });
  });

  it("refuses unsupported, oversized or empty files", async () => {
    await expect(addMaterial("intro-stats", file("a.exe", "application/x-msdownload"))).rejects.toBeInstanceOf(MaterialError);
    await expect(addMaterial("intro-stats", file("e.txt", "text/plain", "   "))).rejects.toThrow(/any study text/);
    ai = true;
    generateText.mockResolvedValueOnce({ text: "NO_CONTENT" });
    await expect(addMaterial("intro-stats", file("p.png", "image/png"))).rejects.toThrow(/any study text/);
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" });
    await expect(addMaterial("intro-stats", big)).rejects.toThrow(/over 10 MB/);
  });

  it("removes a file only from its own course", async () => {
    const m = await addMaterial("intro-stats", file("w.md", "", "Some notes here."));
    expect(removeMaterial("intro-stats", "nope")).toBe(false);
    expect(removeMaterial("intro-stats", m.id)).toBe(true);
    expect(listMaterials("intro-stats")).toEqual([]);
  });

  it("rejects an unknown course", async () => {
    await expect(addMaterial("nope", file("w.md", "", "Notes."))).rejects.toBeInstanceOf(NotFoundError);
  });
});
