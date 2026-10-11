# ProveIt backend handoff

Current source of truth for an engineer or coding agent joining the project mid-flight.

## Product contract

ProveIt is an AI mastery/evidence engine, not a generic quiz generator.

North star: **Know what you actually know.**

```
course material
  -> canonical ConceptLearningSpec
  -> assess visible answer
     -> uncertain: collect more evidence, no invented diagnosis
     -> confirmed misconception: targeted remediation
     -> sound answer: transfer
  -> materially different transfer
     -> pass: provisional
  -> delayed retrieval
     -> pass: mastered
     -> confirmed failure: needs_work
```

Non-negotiable semantics:

- one immediate correct answer is not mastery;
- only transfer can establish `provisional`;
- only delayed retrieval can establish `mastered`;
- `uncertain` never silently becomes a misconception or a demotion;
- app code owns mastery transitions; models evaluate/generate bounded structured artifacts;
- judge visible learner work only, never hidden chain-of-thought;
- preserve evidence and source history instead of overwriting it;
- no fabricated runtime data on `main`.

## Collaboration / branch strategy

Frontend changes move quickly. Do not continuously chase UI churn while doing backend milestones.

At a backend PR boundary:

1. re-check latest `main`;
2. branch from that exact head;
3. build/test the backend subsystem behind stable contracts;
4. merge only an exact green/mergeable head;
5. do broad UI wiring later in one deliberate integration pass.

Canonical demo data stays isolated. PR #5 / `demo/sample-data-db` is **DO NOT MERGE**.

## Stack

- Next.js 16.4 App Router
- React 19
- Tailwind 4
- strict TypeScript
- pnpm
- AI SDK v7
- OpenRouter or Google Gemini
- Clerk
- Node 24 `node:sqlite`
- Vitest 5 / jsdom

Read `AGENTS.md` before changing Next.js code. Never read, print or commit secrets, `.env`, SQLite files or private calendar URLs.

## Model configuration

Model routing lives in `src/server/ai.ts`.

- `OPENROUTER_API_KEY` wins when configured; model from `OPENROUTER_MODEL`.
- otherwise `GOOGLE_GENERATIVE_AI_API_KEY`; model from `GEMINI_MODEL`.
- generated runtime-course evaluation requires AI.
- the two canonical authored gold fixtures retain deterministic offline judges.
- failed model calls surface as errors; do not silently downgrade to a weaker grader.

## Canonical learning content

`src/lib/conceptLearningSpec.ts` defines versioned `ConceptLearningSpec`.

It contains:

- assessment question, canonical answer, rubric and diagnostic probe;
- stable declared misconceptions;
- exactly one targeted remediation per misconception;
- distinct transfer challenge;
- distinct delayed-review challenge;
- skill presentation defaults;
- provenance;
- source IDs and canonical source objects.

A spec never contains learner mastery state, account identity or executable grading code.

Gold authored fixtures:

- `intro-stats/cii` — CI interpretation
- `intro-stats/se` — Standard Error

Their canonical data is in `src/server/authoredLearningSpecs.ts`; deterministic offline graders are in `src/server/authoredJudges.ts`.

## Runtime course generation

`src/server/learningSpecGenerator.ts` generates specs for uploaded/imported/curated runtime courses.

Grounding lifecycle:

1. server reads saved course material;
2. server creates exact excerpt chunks and source IDs;
3. model sees only those excerpts as factual authority;
4. model may reference only supplied source IDs;
5. strict schema/source validation runs;
6. full material fingerprint determines reuse;
7. unchanged material reuses the revision;
8. changed material creates the next immutable revision;
9. stale in-flight generation is discarded;
10. same-user/same-concept/same-fingerprint requests dedupe in process.

Generated specs are user-scoped and persisted through `src/server/learningSpecStore.ts`.

Generation/source validation establishes traceable grounding. It does **not** establish that every generated statement is factually entailed by an excerpt, so never market it as hallucination-free.

## Evaluator

`src/server/evaluator.ts` is spec-first.

Assessment, transfer and review prompts receive:

- canonical answer;
- explicit rubric;
- relevant source context;
- declared misconceptions.

Evaluation rules:

- three independent structured checks;
- majority verdict;
- diagnosis constrained to declared misconception IDs;
- evidence quote accepted only when it occurs in the current learner answer;
- vague/incomplete evidence stays `uncertain`;
- generated specs require AI;
- canonical authored fixtures may use their deterministic fallback;
- no outside knowledge should become grading authority.

## Evidence model

Stored learner evidence kinds:

- `initial`
- `clarification`
- `transfer`
- `review`
- `quiz`

Every mastery attempt preserves:

- course/concept;
- kind/outcome;
- parent and stable root episode lineage;
- learner answer;
- evaluator result when applicable;
- previous mastery state;
- timestamp;
- exact `learningSpecRevision` when canonical content judged it.

Quiz evidence is deliberately weaker:

- answered MCQs may move `not_started -> developing`;
- quiz performance can prioritize study;
- quiz evidence never names a misconception;
- never grants transfer/provisional/mastered;
- never schedules review;
- never demotes stronger mastery;
- never directly awards rank;
- never invalidates an in-flight mastery episode.

## Source lineage

`src/server/sourceLineage.ts` projects canonical sources for backend consumers.

`LearningSourceView` explicitly distinguishes:

- `authored_reference`: metadata label only; no excerpt/material ID; `retrieved=false`;
- `material_excerpt`: exact stored material ID/title/locator/excerpt; `retrieved=true`.

Structured source lineage is exposed from:

- assessment question views;
- targeted remediation;
- transfer challenges;
- delayed-review challenges;
- evidence attempts.

Evidence sources resolve against the exact pinned learning-spec revision. A newer generated revision must not rewrite prior evidence provenance. Legacy evidence without a pinned revision and low-stakes quiz signals intentionally claim no exact source lineage.

## Mastery engine

`src/server/store.ts` owns the state machine.

States:

- `not_started`
- `developing`
- `needs_work`
- `provisional`
- `mastered`

Runtime courses now participate in the same diagnose -> remediation -> transfer -> delayed-review lifecycle as authored concepts when AI is configured.

Transfer/review remain pinned to the revision that started/proved the evidence episode, even if course files later generate a new spec revision.

Review spacing after the latest transfer proof is 7 / 14 / 30 days. Relearning resets the spacing sequence.

## Persistence and accounts

`src/server/userScope.ts` uses `AsyncLocalStorage` for trusted request identity.
`src/server/userBoundary.ts` wraps application page/API boundaries.

With Clerk enabled:

- unscoped learner-state access fails closed;
- learning/evidence;
- runtime courses;
- generated specs;
- materials;
- calendar;
- rank/tasks;
- quiz sessions

are isolated per user.

Local/no-auth mode keeps legacy unscoped ownership. Pre-auth global data is not assigned to arbitrary Clerk accounts.

Durable local state goes through `src/server/persistence.ts`, default:

```
.data/proveit.sqlite
```

This is a local hackathon adapter, not a production hosted DB. There is no multi-process write coordination. Quiz sessions remain ephemeral.

## Study modalities

`src/server/practice.ts`, `quiz.ts`, and `converse.ts` consume canonical learning specs where available.

- study notes/sample papers use canonical course truth;
- generated runtime specs can drive these modalities;
- spoken follow-up/audit uses the canonical spec;
- low-stakes quiz results are recorded as supporting evidence only.

## Important backend paths

| Path | Purpose |
| --- | --- |
| `src/lib/conceptLearningSpec.ts` | canonical learning-content schema |
| `src/server/authoredLearningSpecs.ts` | gold authored specs |
| `src/server/authoredJudges.ts` | deterministic gold-fixture graders |
| `src/server/learningSpecGenerator.ts` | source-grounded runtime generation |
| `src/server/learningSpecStore.ts` | immutable user-scoped generated revisions |
| `src/server/sourceLineage.ts` | structured provenance projection |
| `src/server/evaluator.ts` | spec-first grading |
| `src/server/store.ts` | mastery/evidence engine |
| `src/server/userScope.ts` | per-request user context/caches |
| `src/server/userBoundary.ts` | trusted page/API identity boundary |
| `src/server/persistence.ts` | SQLite adapter |
| `src/server/materials.ts` | saved course material |
| `src/server/ingest.ts` | imported note/course construction |
| `src/server/practice.ts` | notes/paper/weakness views |
| `src/server/quiz.ts` | quiz generation/grading + weak evidence |
| `src/server/converse.ts` | spoken follow-up/audit |
| `src/server/calendar.ts` / `schedule.ts` | calendar/review scheduling |

## Completed backend milestone history

- PR #2 — evidence lineage, clarification and transfer verification
- PR #3 — delayed review and retained mastery
- PR #4 — real/default persistence and sample-data isolation
- PR #6 — user-scoped state/persistence
- PR #7 — canonical `ConceptLearningSpec`
- PR #8 — generated/persisted course-grounded specs
- PR #9 — generalized spec-first evaluator
- PR #10 — runtime-course mastery lifecycle
- PR #11 — low-stakes evidence ingestion + generalized study modalities
- PR #12 — immutable structured source lineage through mastery views

Do not merge PR #5 demo data into `main`.

## Known production/integration limits

Backend semantics are now substantially complete for the hackathon scope. Remaining work is mostly integration/deployment hardening:

- broad end-to-end UI smoke/integration against the latest frontend;
- hosted durable database/storage adapter;
- real Clerk account-switch browser smoke;
- live Gemini/OpenRouter presentation-device smoke;
- Granola/Wispr Flow callback and actual import with real accounts;
- calendar/mic/camera browser-device checks;
- production browser E2E, error/loading hardening;
- `tectonic` is required for local PDF generation and is not on Vercel by default;
- calendar suggested study blocks are not written back;
- only CI interpretation and Standard Error are deterministic authored Intro Statistics gold fixtures; other built-in Stats nodes remain unavailable unless given canonical content.

## Rules to preserve

- Never mark Mastered from one immediate correct answer.
- Never demote or diagnose from `uncertain`.
- Never silently fall back from failed model evaluation.
- Hand-ticking tasks/manual course completion is not mastery evidence.
- Quiz signals are not mastery evidence.
- Never overwrite old evidence/spec revisions.
- Never fabricate source excerpts or convert authored metadata into a quote.
- Never put presentation/sample state on `main`.
- Never merge PR #5.
- Never commit secrets or database files.

## Verification gate

Before every merge:

```bash
pnpm exec next typegen
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Then verify:

- exact PR head CI is green;
- branch is mergeable;
- branch is not behind an incompatible latest `main`;
- no accidental demo/secret/database artifacts;
- claims in README/HANDOFF remain narrower than the actual guarantees.

After this backend hardening milestone, do one deliberate frontend/backend integration pass rather than chasing frontend commits piecemeal.
