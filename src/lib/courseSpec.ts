/** A course that is added at runtime, from a curated file, an upload or an import. */
export type CourseSpec = {
  id: string;
  name: string;
  topic: string;
  level: string;
  summary: string;
  units: { name: string; concepts: { name: string; desc: string; importance?: number }[] }[];
  /** The notes the course was built from. Tutor, notes, papers and quizzes read this. */
  material: string;
  /** Where it came from. */
  source: "catalog" | "upload" | "import";
};

export type CatalogEntry = Pick<CourseSpec, "id" | "name" | "topic" | "level" | "summary"> & { units: number; concepts: number };

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "course";

