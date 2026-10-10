import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { slugify, type CatalogEntry, type CourseSpec } from "@proveit/lib/courseSpec";

const DIR = () => join(process.cwd(), "content", "courses");

function frontMatter(md: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(md);
  if (!m) return { meta: {}, body: md };
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return { meta, body: md.slice(m[0].length) };
}

/** First sentence of a body, capped, for the one-line concept description. */
const firstSentence = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  const end = /[.!?](\s|$)/.exec(t);
  const out = end ? t.slice(0, end.index + 1) : t;
  return out.length > 160 ? `${out.slice(0, 157).trimEnd()}...` : out;
};

/**
 * Reads a course written as markdown. `##` headings are units and `###` headings are concepts. A file with
 * only `##` headings becomes one unit whose concepts are those headings. Returns null when there are no concepts.
 */
export function parseCourseMd(md: string, fallbackName: string, source: CourseSpec["source"], id = slugify(fallbackName)): CourseSpec | null {
  const { meta, body } = frontMatter(md.replace(/\r\n/g, "\n"));
  const h1 = /^#\s+(.+)$/m.exec(body)?.[1]?.trim();
  const lines = body.split("\n");
  const hasH3 = lines.some((l) => /^###\s+\S/.test(l));
  const units: CourseSpec["units"] = [];
  let unit: CourseSpec["units"][number] | null = null;
  let current: { name: string; body: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const text = current.body.join(" ").replace(/\s+/g, " ").trim();
    if (unit && text) unit.concepts.push({ name: current.name, desc: firstSentence(text) });
    current = null;
  };
  for (const line of lines) {
    const h2 = /^##\s+(.+)$/.exec(line);
    const h3 = /^###\s+(.+)$/.exec(line);
    if (h2 && hasH3) { flush(); unit = { name: h2[1]!.trim(), concepts: [] }; units.push(unit); }
    else if (h2) { flush(); unit ??= (units.push({ name: "Topics", concepts: [] }), units[0]!); current = { name: h2[1]!.trim(), body: [] }; }
    else if (h3 && hasH3) { flush(); if (unit) current = { name: h3[1]!.trim(), body: [] }; }
    else if (current) current.body.push(line);
  }
  flush();
  const filled = units.filter((u) => u.concepts.length > 0);
  if (filled.length === 0) return null;
  const name = meta.title || h1 || fallbackName;
  return {
    id, name, topic: meta.topic || "General", level: meta.level || "Beginner",
    summary: meta.summary || firstSentence(lines.filter((l) => l.trim() && !l.startsWith("#")).join(" ")),
    units: filled, material: body.trim().slice(0, 60_000), source,
  };
}

let cache: CourseSpec[] | null = null;

/** Curated courses shipped in content/courses. Each file is one course. */
export function catalogSpecs(): CourseSpec[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  let files: string[] = [];
  try { files = readdirSync(DIR()).filter((f) => f.endsWith(".md")).sort(); } catch { files = []; }
  const specs = files.flatMap((f) => {
    const id = f.replace(/\.md$/, "");
    const spec = parseCourseMd(readFileSync(join(DIR(), f), "utf8"), id, "catalog", id);
    return spec ? [spec] : [];
  });
  cache = specs;
  return specs;
}

export const catalogEntry = (s: CourseSpec): CatalogEntry => ({ id: s.id, name: s.name, topic: s.topic, level: s.level, summary: s.summary, units: s.units.length, concepts: s.units.reduce((n, u) => n + u.concepts.length, 0) });
export const getCatalogSpec = (id: string) => catalogSpecs().find((s) => s.id === id) ?? null;
