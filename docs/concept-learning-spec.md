# ConceptLearningSpec v1

This milestone introduces a shared, validated content contract for authored and future generated concepts. CI interpretation (`intro-stats/cii`, revision 1) and Standard Error (`intro-stats/se`, revision 1) are its first canonical instances.

## Boundaries

- `src/lib/conceptLearningSpec.ts`: strict Zod schema, inferred TypeScript types, and `LearningSpecRef` (`courseId`, `conceptId`, `revision`). `schemaVersion` versions the data shape; `revision` versions a concept's content.
- `src/server/authoredLearningSpecs.ts`: server-only canonical JSON content; course/concept/revision lookup and defensive copies.
- `src/server/authoredJudges.ts`: unchanged authored-only deterministic heuristics. These functions cannot be persisted inside a spec.
- `src/server/content.ts`: compatibility adapter exposing the existing `AUTHORED` shape to current store/evaluator/tutor/practice consumers. Content is derived from the canonical specs, rather than maintained in two places.

A spec contains no learner mastery, attempt history, auth identity or executable grading code. Preserve its course/concept/revision identity when later recording evidence so historical answers can be traced to the rubric used at the time. Runtime generated specs must eventually be stored through the existing user-scoped persistence seam with their course; that storage and revision lifecycle are not implemented in this milestone.

## Required content

| Field | Meaning |
| --- | --- |
| `assessment` | Question, correct-answer/course truth, grading rubric, smaller diagnostic probe, source IDs |
| `misconceptions` | Stable IDs, names, descriptions, discriminating clarification questions, source IDs |
| `remediations` | Exactly one lesson per misconception ID, corrective explanation, optional existing figure/display source label, source IDs |
| `transfer` | Distinct question, reference answer, rubric, hint, source IDs |
| `review` | Distinct delayed-retrieval question, reference answer, rubric, hint, source IDs |
| `sources` | Identified authored reference metadata or material excerpts |
| `provenance` | Authored, or generated with model and generation timestamp |
| `skills` | Existing wrong/right skill presentation values, preserved for compatibility |

Strict validation rejects unsupported versions, missing/blank content, invalid revisions, unknown fields, duplicate/dangling source IDs, duplicate misconceptions, missing/duplicate/dangling remediation targets and questions repeated after case/whitespace normalization. Every content section must reference a known source.

`authored_reference` explicitly means metadata, not a retrieved quote. The authored fixtures retain the existing OpenStax course reference and ProveIt unit labels; no textbook excerpts or verified page citations are invented. Generated specs must supply `material_excerpt` sources including their material ID and excerpt.

## What validation does not establish

A valid JSON shape does not prove an excerpt exists in an uploaded file, the answer is factually grounded, a misconception is supported, or a transfer/review question is materially different pedagogically. Generation and grounding milestones must verify these against the owning user's actual material. Merely paraphrasing a question can pass structural validation and still fail that quality bar.

No model generation, runtime-course mastery, source retrieval, new persistence endpoint, or learner-state transition is added here. The current evaluator still uses `AUTHORED`; it does not yet grade arbitrary `ConceptLearningSpec` objects. The new explicit assessment rubric and challenge reference answers prepare that later interface without changing today's grading prompts.

The compatibility adapter projects the first misconception's remediation into the existing single `lesson` property. Both current fixtures contain one misconception. The future generalized engine must select the remediation by the diagnosed misconception ID.

## Validation and continuation

The authored content and deterministic judge behavior are preserved by the existing flow tests. New contract tests cover JSON round-trips, course/revision isolation, defensive copies, invalid payloads, multiple misconception/remediation mappings, and generated-versus-authored source requirements.

Next milestone: generate validated specs from course material, preserve ownership and source provenance, and add the persistence/revision seam. Then generalize evaluator inputs and runtime mastery behind the existing route contracts. Avoid routing generated concepts into authored fallback judges.
