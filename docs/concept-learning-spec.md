# ConceptLearningSpec v1

`ConceptLearningSpec` is ProveIt's canonical, versioned content contract for teaching and judging one concept. It is shared by authored gold content and source-grounded runtime content.

## Boundaries

- `src/lib/conceptLearningSpec.ts` — strict Zod schema and TypeScript types.
- `src/server/authoredLearningSpecs.ts` — canonical authored fixtures.
- `src/server/authoredJudges.ts` — deterministic grading code for authored gold fixtures only.
- `src/server/learningSpecGenerator.ts` — generation from saved course material.
- `src/server/learningSpecStore.ts` — user-scoped immutable generated revisions.
- `src/server/evaluator.ts` — spec-first assessment/transfer/review grading.
- `src/server/sourceLineage.ts` — structured provenance projection for backend views.
- `src/server/store.ts` — evidence and mastery transitions pinned to spec revisions.

A spec contains no learner mastery, attempt history, auth identity or executable grader.

`schemaVersion` versions the contract shape. `revision` versions the content for one `courseId/conceptId`.

## Required content

| Field | Meaning |
| --- | --- |
| `assessment` | open question, canonical answer, visible-evidence rubric, diagnostic probe, source IDs |
| `misconceptions` | stable IDs, names, descriptions, discriminating clarification questions, source IDs |
| `remediations` | exactly one targeted repair per misconception ID, with source IDs |
| `transfer` | materially different proof question, canonical answer, rubric, hint, source IDs |
| `review` | distinct delayed-retrieval question, canonical answer, rubric, hint, source IDs |
| `sources` | authored reference metadata or exact saved-material excerpts |
| `provenance` | authored, or generated with model identity and timestamp |
| `skills` | presentation values used when evidence is confirmed wrong/right |

Strict validation rejects unsupported schema versions, blank required content, invalid revisions, unknown fields, duplicate/dangling source references, duplicate misconceptions, missing/duplicate remediation targets, and assessment/transfer/review questions that collapse to the same normalized text.

## Source semantics

Two source kinds exist.

### `authored_reference`

Metadata only:

- source ID;
- title;
- optional locator.

It is **not** a retrieved quotation. Backend source views expose it with no material ID/excerpt and `retrieved=false`.

The current authored Intro Statistics gold fixtures use an OpenStax reference label. ProveIt does not invent textbook quotations or page citations for them.

### `material_excerpt`

A retained exact excerpt from saved course material:

- source ID;
- saved material ID;
- title;
- locator;
- excerpt.

Backend source views expose it with `retrieved=true`.

The generator does not ask the model to invent excerpts. Server code selects exact chunks first, assigns source IDs, and sends those bounded chunks to the model.

## Generated runtime specs

For a runtime concept, `ensureConceptLearningSpec(courseId, conceptId)`:

1. reads the owning user's saved course material;
2. selects and ranks exact excerpt chunks;
3. fingerprints the full underlying material;
4. reuses an existing revision when that fingerprint is unchanged;
5. otherwise asks the model to create assessment/misconception/remediation/transfer/review content using only supplied source IDs;
6. validates every cited source ID;
7. validates the full canonical schema;
8. persists the immutable revision under the current user;
9. rejects stale generation if material changed while the model was working.

Concurrent generation for the same user/concept/material fingerprint is deduplicated in process.

Changing material creates the next immutable revision. Older revisions remain available because historical evidence must continue to resolve against the exact rubric/source packet that judged it.

## Evaluation

The evaluator consumes a full validated spec rather than hard-coded concept IDs.

For assessment it receives:

- assessment question;
- canonical answer;
- assessment rubric;
- relevant source excerpts/metadata;
- declared misconceptions and their source context;
- prior evidence in the same clarification episode when applicable.

Transfer and delayed review use their own question, canonical answer, rubric and source IDs.

Three structured model checks vote independently. The majority decides the verdict. An incorrect answer receives a misconception ID only when the diagnosis is one of the declared IDs and a majority supports it. Model-provided evidence quotes are accepted only when they occur verbatim in the current visible learner answer.

Ambiguous/incomplete evidence stays `uncertain`.

Generated content has no deterministic fallback. If AI evaluation is unavailable, runtime mastery fails closed. The authored CI-interpretation and Standard-Error gold fixtures retain canonical deterministic graders for offline/repeatable demos and tests.

## Evidence revision pinning

Mastery evidence created from canonical content stores `learningSpecRevision`.

That revision is used for:

- clarification context;
- diagnosis view;
- remediation;
- transfer;
- delayed-review challenge;
- delayed-review grading;
- structured source lineage.

If course material later produces revision 2, an episode started under revision 1 continues to use revision 1. A review scheduled from a revision-1 transfer also stays on revision 1. This prevents silent historical rubric/source drift.

Legacy attempts created before revision pinning may have no revision. Backend source lineage intentionally returns no exact citation claim for such legacy evidence rather than pretending the current spec is historical proof.

## Mastery lifecycle

Canonical specs now drive runtime concepts through the full state machine:

```
not_started
  -> developing            sound initial evidence
  -> needs_work            confirmed declared misconception
  -> provisional           transfer pass
  -> mastered              due delayed-review pass
```

A confirmed delayed-review misconception returns the concept to `needs_work`.

`uncertain` evidence never diagnoses or demotes.

The remediation displayed after a diagnosis is selected by the diagnosed misconception ID, not by array position.

## Low-stakes evidence

Quiz items are stored as `quiz` evidence but intentionally do not carry a canonical learning-spec revision/source claim unless such a contract is explicitly added later.

Quiz evidence may:

- mark an unseen concept as `developing`;
- influence weakness/study prioritization.

It may not:

- infer a misconception;
- satisfy transfer;
- create `provisional` or `mastered`;
- schedule a review;
- demote stronger mastery;
- directly award rank;
- stale an in-progress mastery episode.

## Source-lineage views

`src/server/sourceLineage.ts` resolves source IDs into a stable `LearningSourceView`.

Backend views expose structured sources for:

- assessment questions;
- remediation;
- transfer challenges;
- delayed-review challenges;
- evidence attempts.

For evidence attempts, source resolution uses the exact pinned spec revision. Assessment/clarification evidence includes assessment authority and, when a specific misconception was diagnosed, that misconception's source IDs. Transfer/review evidence uses its corresponding challenge sources plus a diagnosed misconception's sources when applicable.

Quiz and unpinned legacy evidence return an empty exact-source list rather than an invented citation.

## What the guarantees do and do not mean

The implementation guarantees:

- generated excerpt text came from saved material;
- model citation IDs must name server-supplied excerpts;
- evidence can be traced to an immutable canonical spec revision;
- historical source packets are not silently rewritten;
- grading prompts treat those canonical sources/rubrics as authority.

It does **not** prove:

- that a generated explanation is perfectly entailed by the excerpt;
- that the model can never hallucinate;
- that generated misconceptions are empirically common;
- that a structurally different transfer question is pedagogically perfect.

Use language such as **source-grounded**, **traceable**, **validated against the canonical contract**, and **revision-pinned**. Do not claim hallucination-free or flawless mastery.

## Current authored coverage

Only these built-in Intro Statistics concepts have deterministic authored end-to-end specs:

- CI interpretation (`cii`)
- Standard Error (`se`)

Other built-in Stats map nodes deliberately fail closed for mastery until canonical content exists. Runtime courses can generate specs on demand when AI and readable course material are available.
