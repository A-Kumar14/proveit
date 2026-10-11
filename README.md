# ProveIt

**Know what you actually know.**

ProveIt is an AI mastery/evidence engine. It finds a specific misconception, repairs only that gap, requires proof on a materially different question, and later checks whether the knowledge was retained.

Core loop:

```
course material -> concept learning spec -> assess -> evaluate
  -> uncertain: ask for more visible evidence
  -> misconception: diagnose -> focused remediation -> transfer
  -> sound answer: transfer
transfer pass -> provisional
delayed retrieval pass -> mastered
later retained-knowledge failure -> needs_work
```

A single immediate correct answer is never Mastered.

## Run it

```bash
pnpm install
cp .env.example .env.local   # optional
pnpm dev                     # http://localhost:3000
```

Verification:

```bash
pnpm exec next typegen
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Model calls

Set `OPENROUTER_API_KEY` (model from `OPENROUTER_MODEL`) or `GOOGLE_GENERATIVE_AI_API_KEY` (model from `GEMINI_MODEL`). OpenRouter wins when both are set.

The two gold authored concepts, CI interpretation and Standard Error, retain deterministic offline graders. Generated runtime-course concepts require an AI evaluator; model failure or a missing AI key does not silently fall back to a weaker grader.

Assessment, transfer and delayed-review grading use three independent structured checks. A diagnosis is accepted only when a majority agrees on a declared misconception. Ambiguous evidence remains `uncertain`.

## Course-grounded learning content

`ConceptLearningSpec` is the canonical, versioned JSON contract for assessment, misconceptions, targeted remediation, transfer, delayed review, skills and source references.

For uploaded/imported/runtime courses:

1. saved course material is split into exact server-selected excerpts;
2. the model generates a learning spec using only those excerpts and server-created source IDs;
3. the validated spec is stored per user with an immutable revision;
4. unchanged material reuses the existing revision;
5. changed material creates a new revision;
6. every mastery attempt records the exact revision used to judge it.

Generated source objects retain material ID, title, locator and exact excerpt. Backend mastery views expose structured source lineage. This is grounding/provenance, not a claim that an excerpt independently proves every generated pedagogical statement.

The built-in Intro Statistics course still has deterministic authored end-to-end content only for CI interpretation and Standard Error. Other built-in nodes remain unavailable for mastery until they have canonical content. Runtime courses can generate canonical content on demand when AI is configured.

## Evidence and mastery

Evidence kinds:

- `initial`
- `clarification`
- `transfer`
- `review`
- `quiz`

Quiz answers are intentionally low-stakes signals. They may move an unseen concept to `developing` and influence what ProveIt recommends studying, but they never diagnose a misconception, grant transfer proof, schedule a review, demote stronger mastery, or directly award rank.

Mastery states:

```
not_started
    |
developing
    |
needs_work      <- confirmed misconception / retained-knowledge failure
    |
provisional     <- passed a materially different transfer question
    |
mastered        <- passed a later delayed-retrieval review
```

An incomplete or ambiguous response records evidence but does not invent a misconception. Reviews use spaced retrieval after the latest transfer proof; relearning resets that progression.

## Account isolation and persistence

With Clerk enabled, trusted server identity scopes learner progress, evidence, runtime courses, generated learning specs, materials, calendar state, tasks/rank and quiz sessions. Auth-enabled unscoped state access fails closed. Legacy pre-auth records stay owned by local/no-auth mode rather than being copied to new accounts.

Local durable state uses Node SQLite through `src/server/persistence.ts`. Default development path:

```
.data/proveit.sqlite
```

Set `PROVEIT_DB_PATH` to choose another file. Tests use persistent storage only when they explicitly configure a path.

SQLite is the hackathon/local persistence adapter, **not** a hosted production database. Vercel filesystem persistence is intentionally disabled unless a path is explicitly supplied, and there is no multi-process write coordination.

## Runtime data policy

`main` starts with no fabricated learner progress, sample courses, sample calendar events, sample upload answers or rank points. Test fixtures live under `src/test` and presentation data remains isolated on dedicated demo-data branches. Do not merge demo seed behavior into `main`.

## Where the backend lives

| Path | Purpose |
| --- | --- |
| `src/lib/conceptLearningSpec.ts` | Strict canonical learning-content contract |
| `src/server/authoredLearningSpecs.ts` | Gold authored specs |
| `src/server/authoredJudges.ts` | Deterministic graders for gold authored fixtures |
| `src/server/learningSpecGenerator.ts` | Course-grounded runtime spec generation |
| `src/server/learningSpecStore.ts` | User-scoped immutable generated revisions |
| `src/server/sourceLineage.ts` | Structured source/citation provenance projection |
| `src/server/evaluator.ts` | Spec-first assessment/transfer/review evaluation |
| `src/server/store.ts` | Evidence lineage, mastery state machine, review lifecycle and views |
| `src/server/userScope.ts` / `userBoundary.ts` | Trusted per-user server isolation |
| `src/server/persistence.ts` | SQLite persistence adapter |
| `src/server/materials.ts` / `ingest.ts` | Course material and ingestion |
| `src/server/practice.ts` / `quiz.ts` / `converse.ts` | Study modalities and low-stakes evidence |
| `src/server/calendar.ts` / `schedule.ts` | Calendar and review scheduling |

## Current scope

Built: course upload/import and concept maps, source-grounded generated mastery content, practice, misconception diagnosis, clarification, targeted remediation, transfer proof, delayed review/retention, evidence history, source lineage, review queue, tutor/spoken flows, quizzes and practice documents, rank/to-dos, Clerk account isolation, iCal integration, local persistence, curated courses, and Granola/Wispr Flow connector plumbing.

Important remaining production/integration work:

- one deliberate end-to-end UI integration/smoke pass against the latest frontend;
- hosted/durable production storage instead of local SQLite;
- real account-switch, connector callback/import, Gemini, calendar, mic/camera and presentation-device smoke tests;
- production browser E2E/error/loading hardening;
- `tectonic` is still required for local PDF generation and is not available on Vercel by default;
- calendar study-slot suggestions are not written back to a provider;
- generated grounding/source lineage should not be described as hallucination-free or as proof of factual entailment.

See `HANDOFF.md` for the agent-facing implementation state and `docs/concept-learning-spec.md` for the content/evidence contract.
