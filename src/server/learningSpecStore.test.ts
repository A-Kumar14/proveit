import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ConceptLearningSpec } from "@proveit/lib/conceptLearningSpec";
import { getAuthoredLearningSpec } from "./authoredLearningSpecs";
import { closePersistenceForTests } from "./persistence";
import { clearUserCachesForTests, runAsUser } from "./userScope";
import {
  getGeneratedLearningSpecRecord,
  getLearningSpec,
  removeGeneratedLearningSpecs,
  saveGeneratedLearningSpec,
} from "./learningSpecStore";

let dir: string;

function generated(courseId: string, conceptId: string, revision = 1): ConceptLearningSpec {
  const spec = getAuthoredLearningSpec("intro-stats", "cii")!;
  const sourceId = "source-1";
  spec.courseId = courseId;
  spec.conceptId = conceptId;
  spec.revision = revision;
  spec.provenance = { kind: "generated", model: "test-model", generatedAt: "2026-10-10T00:00:00Z" };
  spec.sources = [{
    id: sourceId,
    kind: "material_excerpt",
    materialId: "m1",
    title: "Private notes",
    locator: "characters 1-120",
    excerpt: "Repeated-sampling notes used only as a test fixture for this generated learning spec.",
  }];
  spec.assessment.sourceIds = [sourceId];
  spec.misconceptions.forEach((m) => { m.sourceIds = [sourceId]; });
  spec.remediations.forEach((r) => { r.sourceIds = [sourceId]; r.figure = null; });
  spec.transfer.sourceIds = [sourceId];
  spec.review.sourceIds = [sourceId];
  return spec;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "proveit-learning-specs-"));
  vi.stubEnv("PROVEIT_DB_PATH", join(dir, "state.sqlite"));
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
  vi.stubEnv("CLERK_SECRET_KEY", "");
  (globalThis as { __proveitLearningSpecs?: unknown }).__proveitLearningSpecs = undefined;
  clearUserCachesForTests();
  closePersistenceForTests();
});

afterEach(() => {
  clearUserCachesForTests();
  closePersistenceForTests();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("generated learning spec persistence", () => {
  it("persists generated revisions per account and restores them after cache/database reload", () => {
    runAsUser("A", () => saveGeneratedLearningSpec(generated("bio", "bio-1"), "fingerprint-a"));

    expect(runAsUser("B", () => getLearningSpec("bio", "bio-1"))).toBeNull();
    expect(runAsUser("A", () => getGeneratedLearningSpecRecord("bio", "bio-1"))).toMatchObject({
      fingerprint: "fingerprint-a",
      spec: { courseId: "bio", conceptId: "bio-1", revision: 1 },
    });

    clearUserCachesForTests();
    closePersistenceForTests();

    expect(runAsUser("A", () => getLearningSpec("bio", "bio-1"))).toMatchObject({
      courseId: "bio",
      conceptId: "bio-1",
      revision: 1,
      provenance: { kind: "generated" },
    });
    expect(runAsUser("B", () => getLearningSpec("bio", "bio-1"))).toBeNull();
  });

  it("returns the newest revision, returns copies, and can remove a course's generated specs", () => {
    saveGeneratedLearningSpec(generated("bio", "bio-1", 1), "one");
    saveGeneratedLearningSpec(generated("bio", "bio-1", 2), "two");
    saveGeneratedLearningSpec(generated("chem", "chem-1", 1), "chem");

    const latest = getLearningSpec("bio", "bio-1")!;
    expect(latest.revision).toBe(2);
    latest.assessment.question = "mutated";
    expect(getLearningSpec("bio", "bio-1")!.assessment.question).not.toBe("mutated");

    expect(removeGeneratedLearningSpecs("bio")).toBe(2);
    expect(getLearningSpec("bio", "bio-1")).toBeNull();
    expect(getLearningSpec("chem", "chem-1")).not.toBeNull();
  });

  it("never lets generated storage shadow canonical authored fixtures", () => {
    saveGeneratedLearningSpec(generated("intro-stats", "cii", 99), "generated-copy");
    expect(getLearningSpec("intro-stats", "cii")).toEqual(getAuthoredLearningSpec("intro-stats", "cii"));
  });

  it("rejects authored content and blank fingerprints in generated storage", () => {
    const authored = getAuthoredLearningSpec("intro-stats", "cii")!;
    expect(() => saveGeneratedLearningSpec(authored, "x")).toThrow(/Only generated/);
    expect(() => saveGeneratedLearningSpec(generated("bio", "bio-1"), "  ")).toThrow(/fingerprint/);
  });
});
