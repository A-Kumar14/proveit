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
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { records?: unknown }).records)
      ? (raw as { records: unknown[] }).records
      : [];
  const records: StoredGeneratedLearningSpec[] = [];
  for (const item of rows) {
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

export function getGeneratedLearningSpecRecord(
  courseId: string,
  conceptId: string,
  revision?: number,
): StoredGeneratedLearningSpec | null {
  const matches = held().records
    .filter((r) =>
      r.spec.courseId === courseId &&
      r.spec.conceptId === conceptId &&
      (revision === undefined || r.spec.revision === revision)
    )
    .sort((a, b) => b.spec.revision - a.spec.revision);
  const latest = matches[0];
  return latest ? { fingerprint: latest.fingerprint, spec: cloneSpec(latest.spec) } : null;
}

export function getGeneratedLearningSpec(
  courseId: string,
  conceptId: string,
  revision?: number,
): ConceptLearningSpecType | null {
  return getGeneratedLearningSpecRecord(courseId, conceptId, revision)?.spec ?? null;
}

/** Authored fixtures take precedence for their exact revision; generated content fills runtime gaps. */
export function getLearningSpec(
  courseId: string,
  conceptId: string,
  revision?: number,
): ConceptLearningSpecType | null {
  return getAuthoredLearningSpec(courseId, conceptId, revision) ?? getGeneratedLearningSpec(courseId, conceptId, revision);
}

export function listGeneratedLearningSpecs(courseId?: string): ConceptLearningSpecType[] {
  return held().records
    .filter((r) => !courseId || r.spec.courseId === courseId)
    .map((r) => cloneSpec(r.spec))
    .sort((a, b) =>
      a.courseId.localeCompare(b.courseId) ||
      a.conceptId.localeCompare(b.conceptId) ||
      a.revision - b.revision
    );
}

/**
 * Generated revisions are append-only. Evidence can later refer to the exact content revision it was
 * assessed against, so an existing revision may be re-saved only when it is byte-for-byte identical.
 */
export function saveGeneratedLearningSpec(
  specInput: ConceptLearningSpecType,
  fingerprint: string,
): ConceptLearningSpecType {
  const spec = ConceptLearningSpec.parse(specInput);
  if (spec.provenance.kind !== "generated") throw new Error("Only generated learning specs belong in generated-spec storage.");
  if (!fingerprint.trim()) throw new Error("A material fingerprint is required.");

  const h = held();
  const same = h.records.find((r) =>
    r.spec.courseId === spec.courseId &&
    r.spec.conceptId === spec.conceptId &&
    r.spec.revision === spec.revision
  );
  if (same) {
    if (same.fingerprint !== fingerprint || JSON.stringify(same.spec) !== JSON.stringify(spec)) {
      throw new Error("Learning spec revisions are immutable.");
    }
    return cloneSpec(same.spec);
  }

  h.records.push({ fingerprint, spec: cloneSpec(spec) });
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
