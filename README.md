# ProveIt

**Know what you actually know.**

ProveIt finds the specific misconception behind a wrong answer, teaches only that gap, makes the learner prove the idea on a different problem, and later checks whether the idea was retained.

Core loop:

```
assess -> evaluate -> diagnose -> remediate -> transfer -> provisional
                                                     |
                                              delayed review
                                                     |
                                                  mastered
```

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

## Data and persistence

The runtime on `main` does **not** start with fake learner progress, fake courses, fake calendar events, fake upload examples, or fake rank points. Intro Statistics is the current authored course catalog; every concept begins `not_started`, rank begins at 0, and progress is produced by actual evidence events.

Learner state is persisted locally in SQLite through `src/server/persistence.ts`. The default development file is:

```
.data/proveit.sqlite
```

Set `PROVEIT_DB_PATH` to choose another SQLite file. Tests do not use persistent storage unless they explicitly provide a path. On Vercel, local filesystem persistence is intentionally disabled unless a persistent path is provided; production cloud persistence still needs a durable database/storage adapter.

Fabricated presentation/demo state is kept off `main` on the dedicated demo-data branches.

## Model calls

Set `OPENROUTER_API_KEY` (model from `OPENROUTER_MODEL`, default `google/gemini-3.8-flash`) or `GOOGLE_GENERATIVE_AI_API_KEY` to use Gemini for grading, tutoring, upload checks, and generated text. Assessment grading uses independent model votes. When no key is present, deterministic judges keep the two authored end-to-end concepts repeatable.

## Mastery semantics

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

An incomplete or ambiguous answer creates an `uncertain` evidence event and does not invent a misconception. A later review failure can return a mastered/provisional concept to `needs_work`.

## Where things live

| Path | Purpose |
| --- | --- |
| `src/server/store.ts` | Learner-state/model seam, mastery transitions, evidence history, review lifecycle |
| `src/server/persistence.ts` | SQLite persistence adapter |
| `src/server/content.ts` | Authored questions, misconceptions, lessons, transfer and delayed-review rubrics |
| `src/server/evaluator.ts` | Assessment/transfer/review evaluators and model voting |
| `src/server/calendar.ts` | Real iCal connection and persisted calendar state |
| `src/server/schedule.ts` | Review queue, course events and suggested study slots |
| `src/lib/schemas.ts` | Shared Zod contracts |
| `src/app/api/*` | Route-handler mutation boundary |
| `src/app/_components/*` | UI |

## Current scope

Built: dashboard, course map, practice, misconception diagnosis, dispute/clarification, focused remediation, transfer proof, delayed review, retained mastery, history/evidence trail, review queue, tutor chat, upload validation, voice/dictation, rank, to-dos, and iCal integration.

Still intentionally incomplete: course ingestion/concept extraction, broader authored course coverage (only CI interpretation and Standard Error run fully end-to-end), source retrieval/citations, dynamic validated transfer generation, durable hosted persistence.

## Account isolation

With Clerk enabled, server pages and every API route resolve authenticated identity before reading or writing learner data. Learning progress, evidence, runtime courses, rank/tasks, calendar, materials and quiz sessions are isolated per user in memory. Durable learner/calendar/material records use user-namespaced SQLite keys. OAuth connection keys retain their existing per-user format. Anonymous requests do not fall back to the local user while Clerk is enabled.

Auth-disabled local mode retains the original unscoped keys and local data. Existing global records are treated as local-owned; they are not copied into signed-in accounts without known ownership. Quiz sessions remain ephemeral, with their existing two-hour lifetime. Browser tier/task celebration memories are also keyed by account; nonsensitive answer-mode/hint preferences remain device preferences. This does not add a hosted database, multi-process write coordination or dynamic-course mastery support.
