import "server-only";
import { ConceptLearningSpec, type ConceptLearningSpec as ConceptLearningSpecValue } from "@proveit/lib/conceptLearningSpec";
import { getAuthoredLearningSpec } from "./authoredLearningSpecs";
import { loadUserJson, saveUserJson } from "./persistence";
import { userCache } from "./userScope";

const KEY = "learning-specs";

type Held = { specs: ConceptLearningSpecValue[] };
const g = globalThis as unknown as { __proveitLearningSpecs?: Held };

const copy = (spec: ConceptLearningSpecValue): ConceptLearningSpecValue =>
  ConceptLearningSpec.parse(JSON.parse(JSON.stringify(spec)));

function restore(): Held {
  const raw = loadUserJson<unknown>(KEY);
  if (!Array.isArray(raw)) return { specs: [] };
  const specs: ConceptLearningSpecValue[] = [];
  for (const row of raw) {
    const parsed = ConceptLearningSpec.safeParse(row);
    if (parsed.success && parsed.data.provenance.kind === "generated") specs.push(parsed.data);
  }
  return { specs };
}

const held = (): Held =>
  userCache("learning-specs", () => (g.__proveitLearningSpecs ??= restore()), restore);

const save = () => saveUserJson(KEY, held().specs);

export function listGeneratedLearningSpecs(courseId?: string): ConceptLearningSpecValue[] {
  return held().specs
    .filter((spec) => !courseId || spec.courseId === courseId)
    .map(copy);
}

export function getGeneratedLearningSpec(courseId: string, conceptId: string, revision?: number): ConceptLearningSpecValue | null {
  const matches = held().specs
    .filter((spec) => spec.courseId === courseId && spec.conceptId === conceptId && (revision === undefined || spec.revision === revision))
    .sort((a, b) => b.revision - a.revision);
  return matches[0] ? copy(matches[0]) : null;
}

/** Resolves canonical authored content first, then the user's generated runtime content. */
export function getLearningSpec(courseId: string, conceptId: string, revision?: number): ConceptLearningSpecValue | null {
  return getAuthoredLearningSpec(courseId, conceptId, revision) ?? getGeneratedLearningSpec(courseId, conceptId, revision);
}

export function nextLearningSpecRevision(courseId: string, conceptId: string): number {
  const authored = getAuthoredLearningSpec(courseId, conceptId);
  const generated = getGeneratedLearningSpec(courseId, conceptId);
  return Math.max(authored?.revision ?? 0, generated?.revision ?? 0) + 1;
}

/**
 * Persists one generated spec inside the current user's namespace.
 * Exact refs are replaced so retries are idempotent; older revisions remain available for audit.
 */
export function saveGeneratedLearningSpec(input: ConceptLearningSpecValue): ConceptLearningSpecValue {
  const spec = ConceptLearningSpec.parse(input);
  if (spec.provenance.kind !== "generated") throw new Error("Only generated learning specs belong in user storage.");

  const h = held();
  const i = h.specs.findIndex((row) =>
    row.courseId === spec.courseId &&
    row.conceptId === spec.conceptId &&
    row.revision === spec.revision
  );
  if (i >= 0) h.specs[i] = spec;
  else h.specs.push(spec);
  save();
  return copy(spec);
}

export function removeGeneratedLearningSpecs(courseId: string): number {
  const h = held();
  const before = h.specs.length;
  h.specs = h.specs.filter((spec) => spec.courseId !== courseId);
  const removed = before - h.specs.length;
  if (removed) save();
  return removed;
}
