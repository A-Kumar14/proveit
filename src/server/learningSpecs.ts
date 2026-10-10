import "server-only";
import { ConceptLearningSpec, type ConceptLearningSpec as ConceptLearningSpecValue } from "@proveit/lib/conceptLearningSpec";
import { getAuthoredLearningSpec } from "./authoredLearningSpecs";
import { loadUserJson, saveUserJson } from "./persistence";
import { userCache } from "./userScope";

const KEY = "learning-specs";

export type GeneratedLearningSpecRecord = {
  fingerprint: string;
  spec: ConceptLearningSpecValue;
};

type Held = { records: GeneratedLearningSpecRecord[] };
const g = globalThis as unknown as { __proveitLearningSpecs?: Held };

function restore(): Held {
  const raw = loadUserJson<unknown>(KEY);
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { records?: unknown }).records)) return { records: [] };
  const records: GeneratedLearningSpecRecord[] = [];
  for (const candidate of (raw as { records: unknown[] }).records) {
    if (!candidate || typeof candidate !== "object") continue;
    const fingerprint = (candidate as { fingerprint?: unknown }).fingerprint;
    const parsed = ConceptLearningSpec.safeParse((candidate as { spec?: unknown }).spec);
    if (typeof fingerprint !== "string" || !fingerprint || !parsed.success || parsed.data.provenance.kind !== "generated") continue;
    records.push({ fingerprint, spec: parsed.data });
  }
  return { records };
}

const held = (): Held => userCache("learning-specs", () => (g.__proveitLearningSpecs ??= restore()), restore);
const persist = () => saveUserJson(KEY, held());
const copy = (spec: ConceptLearningSpecValue) => ConceptLearningSpec.parse(spec);

export function getGeneratedLearningSpecRecord(courseId: string, conceptId: string, revision?: number): GeneratedLearningSpecRecord | null {
  const matches = held().records
    .filter((r) => r.spec.courseId === courseId && r.spec.conceptId === conceptId && (revision === undefined || r.spec.revision === revision))
    .sort((a, b) => b.spec.revision - a.spec.revision);
  const record = matches[0];
  return record ? { fingerprint: record.fingerprint, spec: copy(record.spec) } : null;
}

export function getGeneratedLearningSpec(courseId: string, conceptId: string, revision?: number): ConceptLearningSpecValue | null {
  return getGeneratedLearningSpecRecord(courseId, conceptId, revision)?.spec ?? null;
}

/** Authored content always wins for its exact course/concept pair; generated content fills runtime gaps. */
export function getLearningSpec(courseId: string, conceptId: string, revision?: number): ConceptLearningSpecValue | null {
  return getAuthoredLearningSpec(courseId, conceptId, revision) ?? getGeneratedLearningSpec(courseId, conceptId, revision);
}

export function listGeneratedLearningSpecs(courseId?: string): ConceptLearningSpecValue[] {
  return held().records
    .filter((r) => !courseId || r.spec.courseId === courseId)
    .map((r) => copy(r.spec))
    .sort((a, b) => a.courseId.localeCompare(b.courseId) || a.conceptId.localeCompare(b.conceptId) || a.revision - b.revision);
}

/**
 * Persists only validated generated content. Revisions are append-only so evidence can later point to
 * the exact content revision it was assessed against.
 */
export function saveGeneratedLearningSpec(spec: ConceptLearningSpecValue, fingerprint: string): ConceptLearningSpecValue {
  const parsed = ConceptLearningSpec.parse(spec);
  if (parsed.provenance.kind !== "generated") throw new Error("Only generated learning specs belong in generated storage.");
  if (!fingerprint.trim()) throw new Error("Generated learning specs need a source fingerprint.");

  const h = held();
  const same = h.records.find((r) =>
    r.spec.courseId === parsed.courseId &&
    r.spec.conceptId === parsed.conceptId &&
    r.spec.revision === parsed.revision,
  );
  if (same) {
    if (same.fingerprint !== fingerprint || JSON.stringify(same.spec) !== JSON.stringify(parsed)) {
      throw new Error("Learning spec revisions are immutable.");
    }
    return copy(same.spec);
  }

  h.records.push({ fingerprint, spec: parsed });
  persist();
  return copy(parsed);
}

export function removeCourseLearningSpecs(courseId: string): void {
  const h = held();
  const keep = h.records.filter((r) => r.spec.courseId !== courseId);
  if (keep.length === h.records.length) return;
  h.records = keep;
  persist();
}
