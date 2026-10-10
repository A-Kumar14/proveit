import "server-only";
import { catalogEntry, catalogSpecs, getCatalogSpec } from "./catalog";
import { addCourseSpec, addedCourseIds, NotFoundError, removeAddedCourse } from "./store";
import type { CatalogEntry } from "@proveit/lib/courseSpec";

export type CatalogItem = CatalogEntry & { added: boolean };

/** Every curated course, marked with whether the student already has it. */
export function browseCatalog(): CatalogItem[] {
  const have = new Set(addedCourseIds());
  return catalogSpecs().map((s) => ({ ...catalogEntry(s), added: have.has(s.id) }));
}

export function addCatalogCourse(id: string): { id: string; added: boolean } {
  const spec = getCatalogSpec(id);
  if (!spec) throw new NotFoundError(`catalog course ${id}`);
  return addCourseSpec(spec);
}

export function removeCatalogCourse(id: string): { removed: boolean } {
  return { removed: removeAddedCourse(id) };
}
