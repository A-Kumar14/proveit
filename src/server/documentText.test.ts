import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { documentKind, documentText, htmlText, isLegacyOffice, UnreadableDocumentError } from "./documentText";
import { outlineFromText } from "./courseUpload";

/** Smallest zip that Office readers accept: local headers, a central directory and the end record. Every entry is deflated. */
function zip(entries: Record<string, string>): Buffer {
  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name), raw = Buffer.from(text), data = deflateRawSync(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

const file = (name: string, body: Buffer | string, type = "") => new File([new Uint8Array(Buffer.from(body))], name, { type });

const para = (text: string, style?: string, list = false) =>
  `<w:p>${style || list ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${list ? `<w:numPr><w:ilvl w:val="0"/></w:numPr>` : ""}</w:pPr>` : ""}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

describe("documentKind", () => {
  it("uses the extension first, then the type", () => {
    expect(documentKind({ name: "a.docx", type: "" })).toBe("docx");
    expect(documentKind({ name: "a.PPTX", type: "application/octet-stream" })).toBe("pptx");
    expect(documentKind({ name: "grades.csv", type: "application/vnd.ms-excel" })).toBe("csv");
    expect(documentKind({ name: "download", type: "text/html" })).toBe("html");
    expect(documentKind({ name: "a.pdf", type: "application/pdf" })).toBeNull();
    expect(isLegacyOffice("old.ppt")).toBe(true);
    expect(isLegacyOffice("new.pptx")).toBe(false);
  });
});

describe("documentText", () => {
  it("reads a Word document as headings, bullets and paragraphs that the outline parser understands", async () => {
    const body = [
      para("Biology 101", "Title"),
      para("Week 1: Cells", "Heading1"),
      para("Cell membrane: controls what enters &amp; leaves", undefined, true),
      para("Organelles", undefined, true),
      "<w:p/>",
      para("Read chapter 2 before class."),
      para("Genetics", "Heading2"),
      para("DNA replication", "ListParagraph"),
    ].join("");
    const docx = zip({ "word/document.xml": `<?xml version="1.0"?><w:document><w:body>${body}</w:body></w:document>` });
    const text = await documentText(file("bio.docx", docx));
    expect(text).toContain("# Biology 101");
    expect(text).toContain("# Week 1: Cells");
    expect(text).toContain("- Cell membrane: controls what enters & leaves");
    expect(text).toContain("Read chapter 2 before class.");
    expect(text).toContain("## Genetics");
    const outline = outlineFromText(text);
    expect(outline.units.map((u) => u.name)).toEqual(["Cells", "Genetics"]);
    expect(outline.units[0].concepts.map((c) => c.name)).toEqual(["Cell membrane", "Organelles"]);
  });

  it("reads slides in presentation order, titles as headings, with speaker notes", async () => {
    const slide = (...lines: string[]) => `<p:sld><p:cSld><p:spTree>${lines.map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`).join("")}</p:spTree></p:cSld></p:sld>`;
    const pptx = zip({
      "ppt/presentation.xml": `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`,
      "ppt/_rels/presentation.xml.rels": `<Relationships><Relationship Id="rId2" Target="slides/slide1.xml"/><Relationship Id="rId3" Target="slides/slide2.xml"/></Relationships>`,
      "ppt/slides/slide1.xml": slide("Hypothesis testing", "Null vs. alternative", "p-value"),
      "ppt/slides/slide2.xml": slide("Sampling", "Population vs. sample"),
      "ppt/slides/_rels/slide2.xml.rels": `<Relationships><Relationship Id="rId1" Target="../notesSlides/notesSlide1.xml"/></Relationships>`,
      "ppt/notesSlides/notesSlide1.xml": `<p:notes>${["Stress random sampling.", "1"].map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`).join("")}</p:notes>`,
    });
    const text = await documentText(file("deck.pptx", pptx));
    expect(text.indexOf("## Sampling")).toBeLessThan(text.indexOf("## Hypothesis testing"));
    expect(text).toContain("- Population vs. sample");
    expect(text).toContain("Notes: Stress random sampling.");
    expect(text).not.toMatch(/Notes:.*\b1\b/);
    expect(outlineFromText(text).units.map((u) => u.name)).toEqual(["Sampling", "Hypothesis testing"]);
  });

  it("falls back to slide file order when presentation.xml has no list", async () => {
    const pptx = zip({
      "ppt/slides/slide1.xml": `<p:sld><a:p><a:r><a:t>First</a:t></a:r></a:p></p:sld>`,
      "ppt/slides/slide2.xml": `<p:sld><a:p><a:r><a:t>Second</a:t></a:r></a:p></p:sld>`,
    });
    const text = await documentText(file("deck.pptx", pptx));
    expect(text.indexOf("First")).toBeLessThan(text.indexOf("Second"));
  });

  it("reads every sheet of a workbook, with shared, inline and number cells", async () => {
    const xlsx = zip({
      "xl/workbook.xml": `<workbook><sheets><sheet name="Week 1" sheetId="1" r:id="rId1"/><sheet name="Q&amp;A" sheetId="2" r:id="rId2"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>`,
      "xl/sharedStrings.xml": `<sst><si><t>Term</t></si><si><t>Definition</t></si><si><r><t>Standard </t></r><r><t>error</t></r></si></sst>`,
      "xl/worksheets/sheet1.xml": `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="inlineStr"><is><t>Spread of a statistic</t></is></c><c r="C2"><v>0.5</v></c></row><row r="3"><c r="A3"/></row></sheetData></worksheet>`,
      "xl/worksheets/sheet2.xml": `<worksheet><sheetData><row r="1"><c r="A1" t="str"><v>Why n?</v></c></row></sheetData></worksheet>`,
    });
    const text = await documentText(file("terms.xlsx", xlsx));
    expect(text).toContain("## Week 1\nTerm | Definition\nStandard error | Spread of a statistic | 0.5");
    expect(text).toContain("## Q&A\nWhy n?");
  });

  it("keeps the structure of a web page and drops scripts, styles and markup", async () => {
    const html = `<html><head><title>x</title><style>h1{}</style></head><body><script>alert(1)</script>
      <h1>Unit 3: <em>Confidence</em> intervals</h1><p>Read&nbsp;this &amp; that.</p><ul><li>Margin of error</li><li>CI interpretation</li></ul>
      <table><tr><td>a</td><td>b</td></tr></table><!-- hidden --></body></html>`;
    const text = htmlText(html);
    expect(text).toContain("# Unit 3: Confidence intervals");
    expect(text).toContain("Read this & that.");
    expect(text).toContain("- Margin of error\n- CI interpretation");
    expect(text).toContain("a | b");
    expect(text).not.toContain("b |");
    expect(text).not.toMatch(/alert|h1\{|hidden|<|title/);
    expect(await documentText(file("page.htm", html, "text/html"))).toBe(text);
  });

  it("passes CSV through as text", async () => {
    expect(await documentText(file("a.csv", "term,meaning\nmean,average", "text/csv"))).toBe("term,meaning\nmean,average");
  });

  it("explains a damaged or mislabelled Office file instead of crashing", async () => {
    await expect(documentText(file("fake.docx", "just some text"))).rejects.toBeInstanceOf(UnreadableDocumentError);
    await expect(documentText(file("empty.xlsx", zip({ "readme.txt": "hi" })))).resolves.toBe("");
    await expect(documentText(file("nodoc.docx", zip({ "readme.txt": "hi" })))).rejects.toThrow(/damaged/);
  });
});
