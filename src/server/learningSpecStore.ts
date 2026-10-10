import "server-only";
import { ConceptLearningSpec, type ConceptLearningSpec as ConceptLearningSpecType } from "@proveit/lib/conceptLearningSpec";
import { getAuthoredLearningSpec } from "./authoredLearningSpecs";
import { loadUserJson, saveUserJson } from "./persistence";
import { userCache } from "./userScope";

const KEY = "learning-specs:v1";

export type StoredGeneratedLearningSpec = {
  fingerprint: string;
  spec: ConceptLearningSpecType;
};

type Held = { records: StoredGeneratedLearningSpec[] };
const g = globalThis as unknown as { __proveitLearningSpecs?: Held };

const cloneSpec = (spec: ConceptLearningSpecType): ConceptLearningSpecType =>
  ConceptLearningSpec.parse(JSON.parse(JSON.stringify(spec)));

function restore(): Held {
  const raw = loadUserJson<unknown>(KEY);
  if (!Array.isArray(raw)) return { records: [] };
  const records: StoredGeneratedLearningSpec[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as { fingerprint?: unknown; spec?: unknown };
    if (typeof candidate.fingerprint !== "string" || !candidate.fingerprint) continue;
    const parsed = ConceptLearningSpec.safeParse(candidate.spec);
    if (!parsed.success || parsed.data.provenance.kind !== "generated") continue;
    records.push({ fingerprint: candidate.fingerprint, spec: parsed.data });
  }
  return { records };
}

const held = (): Held => userCache("learning-specs", () => (g.__proveitLearningSpecs ??= restore()), restore);
const persist = () => saveUserJson(KEY, held().records);

/** Authored fixtures take precedence; otherwise return the newest persisted generated revision. */
export function getLearningSpec(courseId: string, conceptId: string): ConceptLearningSpecType | null {
  const authored = getAuthoredLearningSpec(courseId, conceptId);
  if (authored) return authored;
  const matches = held().records.filter((r) => r.spec.courseId === courseId && r.spec.conceptId === conceptId);
  const latest = matches.sort((a, b) => b.spec.revision - a.spec.revision)[0];
  return latest ? cloneSpec(latest.spec) : null;
}

export function getGeneratedLearningSpecRecord(courseId: string, conceptId: string): StoredGeneratedLearningSpec | null {
  const matches = held().records.filter((r) => r.spec.courseId === courseId && r.spec.conceptId === conceptId);
  const latest = matches.sort((a, b) => b.spec.revision - a.spec.revision)[0];
  return latest ? { fingerprint: latest.fingerprint, spec: cloneSpec(latest.spec) } : null;
}

/**
 * Persist a generated revision for the current user. Re-saving the same revision replaces it;
 * callers that regenerate changed material should increment the revision.
 */
export function saveGeneratedLearningSpec(specInput: ConceptLearningSpecType, fingerprint: string): ConceptLearningSpecType {
  const spec = ConceptLearningSpec.parse(specInput);
  if (spec.provenance.kind !== "generated") throw new Error("Only generated learning specs belong in generated-spec storage.");
  if (!fingerprint.trim()) throw new Error("A material fingerprint is required.");

  const h = held();
  const existing = h.records.findIndex((r) =>
    r.spec.courseId === spec.courseId &&
    r.spec.conceptId === spec.conceptId &&
    r.spec.revision === spec.revision
  );
  const record = { fingerprint, spec: cloneSpec(spec) };
  if (existing >= 0) h.records[existing] = record;
  else h.records.push(record);
  persist();
  return cloneSpec(spec);
}

export function removeGeneratedLearningSpecs(courseId: string): number {
  const h = held();
  const before = h.records.length;
  h.records = h.records.filter((r) => r.spec.courseId !== courseId);
  const removed = before - h.records.length;
  if (removed) persist();
  return removed;
}
