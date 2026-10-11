// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { EvidenceTrail } from "./EvidenceTrail";
import type { EvidenceAttemptView } from "@proveit/server/store";

afterEach(cleanup);

it("shows the pinned content revision and separates exact excerpts from reference labels", () => {
  const row: EvidenceAttemptView = {
    id: "a1", courseId: "biology", conceptId: "membrane", kind: "initial", outcome: "correct",
    parentAttemptId: null, rootAttemptId: "a1", learningSpecRevision: 2, answer: "It controls transport.",
    evaluation: null, previousState: "not_started", createdAt: 0,
    sources: [
      { id: "notes", kind: "material_excerpt", materialId: "m1", title: "Saved notes", locator: "paragraph 2", excerpt: "The membrane controls transport.", retrieved: true },
      { id: "reference", kind: "authored_reference", materialId: null, title: "Authored reference", locator: null, excerpt: null, retrieved: false },
    ],
  };
  render(<EvidenceTrail rows={[row]} />);
  expect(screen.getByText("Content revision 2")).toBeTruthy();
  expect(screen.getByText("The membrane controls transport.")).toBeTruthy();
  expect(screen.getByText("· course excerpt")).toBeTruthy();
  expect(screen.getByText("· reference label")).toBeTruthy();
});
