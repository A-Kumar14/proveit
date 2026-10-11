import "server-only";
import type { ConceptLearningSpec } from "@proveit/lib/conceptLearningSpec";

export type LearningSourceView = {
  id: string;
  kind: "authored_reference" | "material_excerpt";
  title: string;
  locator: string | null;
  materialId: string | null;
  excerpt: string | null;
  /** True only when this source is an exact excerpt retained from saved course material. */
  retrieved: boolean;
};

/**
 * Resolve canonical source IDs without inventing citations. Authored references remain metadata-only;
 * generated material excerpts preserve the exact stored excerpt and material identity.
 */
export function learningSourceViews(spec: ConceptLearningSpec, sourceIds: readonly string[]): LearningSourceView[] {
  const byId = new Map(spec.sources.map((source) => [source.id, source]));
  const seen = new Set<string>();
  return sourceIds.flatMap((id): LearningSourceView[] => {
    if (seen.has(id)) return [];
    seen.add(id);
    const source = byId.get(id);
    if (!source) throw new Error(`Unknown learning source ${id} for ${spec.courseId}/${spec.conceptId}@${spec.revision}.`);
    if (source.kind === "material_excerpt") {
      return [{
        id: source.id,
        kind: source.kind,
        title: source.title,
        locator: source.locator,
        materialId: source.materialId,
        excerpt: source.excerpt,
        retrieved: true,
      }];
    }
    return [{
      id: source.id,
      kind: source.kind,
      title: source.title,
      locator: source.locator,
      materialId: null,
      excerpt: null,
      retrieved: false,
    }];
  });
}

/** Stable ordered union for sections whose grading authority includes more than one source group. */
export function sourceIdUnion(...groups: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  return groups.flatMap((group) => group.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }));
}
