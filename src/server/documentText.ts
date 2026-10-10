import "server-only";
import { inflateRawSync } from "node:zlib";

/**
 * Word, PowerPoint, Excel, HTML and CSV files become plain text with simple markdown headings and bullets,
 * so they flow through the same path as .md notes: the outline parser without a model key, the model with one.
 * Office files are zipped XML, so node:zlib and a few patterns are enough. No parsing dependency.
 */

export type DocumentKind = "docx" | "pptx" | "xlsx" | "html" | "csv";

export class UnreadableDocumentError extends Error {}

const BY_EXT: Record<string, DocumentKind> = { docx: "docx", pptx: "pptx", xlsx: "xlsx", html: "html", htm: "html", csv: "csv" };
const BY_MIME: Record<string, DocumentKind> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/html": "html",
  "text/csv": "csv",
};

export const DOCUMENT_LABEL: Record<DocumentKind, string> = { docx: "Word document", pptx: "Slides", xlsx: "Spreadsheet", html: "Web page", csv: "Spreadsheet" };

/** The old binary formats (.doc, .ppt, .xls) are not zipped XML, so they get their own message. */
export const isLegacyOffice = (name: string) => /\.(doc|ppt|xls)$/i.test(name);

/** The extension wins: Windows browsers often send .csv as an Excel type, and some send Office files with no type. */
export function documentKind(f: { name: string; type: string }): DocumentKind | null {
  const ext = f.name.toLowerCase().split(".").pop() ?? "";
  return BY_EXT[ext] ?? BY_MIME[f.type] ?? null;
}

// ---- zip ----

/** Stops a small zip from inflating into something huge. */
const MAX_ENTRY_BYTES = 50 * 1024 * 1024;

type Zip = (path: string) => string | null;

function openZip(buf: Buffer): Zip {
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new UnreadableDocumentError("not a zip");
  const entries = new Map<string, { method: number; offset: number; size: number; full: number }>();
  let p = buf.readUInt32LE(end + 16);
  for (let n = buf.readUInt16LE(end + 10); n > 0 && p + 46 <= buf.length && buf.readUInt32LE(p) === 0x02014b50; n--) {
    const nameLen = buf.readUInt16LE(p + 28);
    entries.set(buf.toString("utf8", p + 46, p + 46 + nameLen), {
      method: buf.readUInt16LE(p + 10), size: buf.readUInt32LE(p + 20), full: buf.readUInt32LE(p + 24), offset: buf.readUInt32LE(p + 42),
    });
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return (path) => {
    const e = entries.get(path);
    if (!e || e.full > MAX_ENTRY_BYTES || e.offset + 30 > buf.length) return null;
    const start = e.offset + 30 + buf.readUInt16LE(e.offset + 26) + buf.readUInt16LE(e.offset + 28);
    const raw = buf.subarray(start, start + e.size);
    if (e.method === 0) return raw.toString("utf8");
    if (e.method === 8) return inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES }).toString("utf8");
    return null;
  };
}

/** Targets in .rels files are relative to the part's folder, or absolute from the package root. */
function relTargets(zip: Zip, relsPath: string, baseDir: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [, attrs] of (zip(relsPath) ?? "").matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /\bId="([^"]+)"/.exec(attrs)?.[1], target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
    if (!id || !target) continue;
    const parts = target.startsWith("/") ? target.slice(1).split("/") : [...baseDir.split("/").filter(Boolean), ...target.split("/")];
    const path: string[] = [];
    for (const part of parts) {
      if (part === "..") path.pop();
      else if (part !== ".") path.push(part);
    }
    out.set(id, path.join("/"));
  }
  return out;
}

// ---- xml text ----

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? m;
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
  });
}
const clean = (s: string) => s.replace(/[ \t ]+/g, " ").trim();
/** The text runs of one paragraph, joined in order. */
const runs = (xml: string, tag: string) => clean(decode([...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, "g"))].map((m) => m[1]).join("")));
/** Matches `<x:p>…</x:p>` and the empty `<x:p/>`, never `<x:pPr>`. */
const paragraphs = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*?)?(?:/>|>([\\s\\S]*?)</${tag}>)`, "g"))].map((m) => m[1] ?? "");

// ---- formats ----

function wordText(zip: Zip): string {
  const xml = zip("word/document.xml");
  if (!xml) throw new UnreadableDocumentError("no document.xml");
  const lines: string[] = [];
  for (const p of paragraphs(xml, "w:p")) {
    const text = runs(p.replace(/<w:(?:tab|br)\b[^>]*\/>/g, "<w:t> </w:t>"), "w:t");
    if (!text) continue;
    const style = /<w:pStyle\s+w:val="([^"]+)"/.exec(p)?.[1] ?? "";
    const level = /^title$/i.test(style) ? 1 : Number(/^heading\s?(\d)$/i.exec(style)?.[1] ?? 0);
    if (level) lines.push("", `${"#".repeat(Math.min(level, 4))} ${text}`);
    else if (/<w:numPr\b/.test(p) || /^list/i.test(style)) lines.push(`- ${text}`);
    else lines.push(text);
  }
  return lines.join("\n");
}

function slidesText(zip: Zip): string {
  // presentation.xml lists the slides in the order they are shown; file numbers can drift after reordering.
  const rels = relTargets(zip, "ppt/_rels/presentation.xml.rels", "ppt");
  let slides = [...(zip("ppt/presentation.xml") ?? "").matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].flatMap(([, id]) => rels.get(id) ?? []);
  if (slides.length === 0) {
    slides = [];
    for (let n = 1; n <= 500 && zip(`ppt/slides/slide${n}.xml`) !== null; n++) slides.push(`ppt/slides/slide${n}.xml`);
  }
  const out: string[] = [];
  slides.forEach((path) => {
    const xml = zip(path);
    if (!xml) return;
    const lines = paragraphs(xml, "a:p").map((p) => runs(p, "a:t")).filter(Boolean);
    if (lines.length === 0) return;
    const [title, ...body] = lines;
    out.push("", `## ${title}`, ...body.map((l) => `- ${l}`));
    const dir = path.slice(0, path.lastIndexOf("/")), file = path.slice(path.lastIndexOf("/") + 1);
    const notesPath = [...relTargets(zip, `${dir}/_rels/${file}.rels`, dir).values()].find((t) => t.includes("notesSlide"));
    // Notes slides repeat the slide number as text, so bare numbers are dropped.
    const notes = notesPath ? paragraphs(zip(notesPath) ?? "", "a:p").map((p) => runs(p, "a:t")).filter((l) => l && !/^\d+$/.test(l)) : [];
    if (notes.length) out.push(`Notes: ${notes.join(" ")}`);
  });
  return out.join("\n");
}

/** Spreadsheets are capped so a huge sheet can't stall the request; the text is cut later anyway. */
const MAX_ROWS = 2_000;

function sheetText(zip: Zip): string {
  const shared = [...(zip("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, si]) => runs(si.replace(/<rPh\b[\s\S]*?<\/rPh>/g, ""), "t"));
  const rels = relTargets(zip, "xl/_rels/workbook.xml.rels", "xl");
  const sheets = [...(zip("xl/workbook.xml") ?? "").matchAll(/<sheet\b([^>]*)\/?>/g)].flatMap(([, attrs]) => {
    const name = decode(/\bname="([^"]*)"/.exec(attrs)?.[1] ?? ""), path = rels.get(/\br:id="([^"]+)"/.exec(attrs)?.[1] ?? "");
    return path ? [{ name, path }] : [];
  });
  const out: string[] = [];
  let rows = 0;
  for (const { name, path } of sheets) {
    const xml = zip(path);
    if (!xml) continue;
    out.push("", `## ${name}`);
    for (const [, row] of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      if (++rows > MAX_ROWS) return out.join("\n");
      const cells = [...row.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(([, attrs, body = ""]) => {
        const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
        if (type === "inlineStr") return runs(body, "t");
        const value = decode(/<v>([^<]*)<\/v>/.exec(body)?.[1] ?? "");
        return type === "s" ? shared[Number(value)] ?? "" : clean(value);
      });
      const line = cells.join(" | ").replace(/(?:\s*\|\s*)+$/, "");
      if (line.replace(/[\s|]/g, "")) out.push(line);
    }
  }
  return out.join("\n");
}

export function htmlText(html: string): string {
  const inline = (s: string) => clean(decode(s.replace(/<[^>]+>/g, " ")));
  const text = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n: string, t: string) => `\n\n${"#".repeat(Math.min(Number(n), 4))} ${inline(t)}\n`)
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<(?:br|hr)\b[^>]*>|<\/(?:p|div|tr|ul|ol|table|section|article|header|footer|blockquote|pre|dd|dt)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decode(text).split("\n").map((l) => clean(l).replace(/\s*\|$/, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Turns a supported document into markdown-ish text. Throws UnreadableDocumentError for a damaged or mislabelled file. */
export async function documentText(file: File): Promise<string> {
  const kind = documentKind(file);
  if (!kind) throw new UnreadableDocumentError(`${file.name} is not a supported document.`);
  if (kind === "csv") return await file.text();
  if (kind === "html") return htmlText(await file.text());
  try {
    const zip = openZip(Buffer.from(await file.arrayBuffer()));
    return kind === "docx" ? wordText(zip) : kind === "pptx" ? slidesText(zip) : sheetText(zip);
  } catch {
    // Truncated zips, bad offsets and corrupt deflate streams all mean the same thing to the student.
    throw new UnreadableDocumentError(`${file.name} looks damaged or isn't really a .${kind} file.`);
  }
}
