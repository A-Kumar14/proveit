# Handoff

Current source of truth for an AI coding agent joining ProveIt mid-flight.

## Product

ProveIt is an AI mastery/evidence engine. It does not treat a correct answer as mastery.

```
course material -> assess -> evaluate
  -> uncertain: ask one discriminating follow-up
  -> misconception: diagnose -> focused remediation -> transfer
  -> sound answer: transfer
transfer pass -> provisional
delayed retrieval pass -> mastered
later retention failure -> needs_work -> repair again
```

North star: **Know what you actually know.**

## Current branch/data policy

- `main` contains real/default runtime behavior only. No fabricated learner progress, sample courses, sample calendar events, sample upload answers, or starting rank.
- Unit tests may use fixtures under `src/test/`; those fixtures never enter runtime state.
- Presentation/sample data is isolated on demo-data branches.
- Never reintroduce `PROVEIT_DATA=demo` or other seeded product state to `main`.

## Stack

- Next.js 16.4 App Router, React 19, Tailwind 4, TypeScript strict, pnpm.
- AI SDK v7 + Gemini.
- Route handlers + Zod contracts, no tRPC.
- Local persistence uses Node 24 `node:sqlite` through `src/server/persistence.ts`.
- Tests: Vitest 5, jsdom for component tests.

Read `AGENTS.md` before changing Next.js code.

## Persistence

Default local DB: `.data/proveit.sqlite` (gitignored).

`PROVEIT_DB_PATH` can point to another SQLite file. Tests disable persistence unless they explicitly set this variable. Vercel/local ephemeral files are not a production database; deployed durability still requires persistent storage or swapping the adapter.

Static course/catalog content remains in code for this hackathon. Learner-derived state is what persists: concept mastery/skills/evidence, attempts, review dates, task state, peak points, and course completion override. Calendar connection state is persisted separately.

## Evidence model

Every learner response is an evidence event:

- `initial`
- `clarification`
- `transfer`
- `review`

Each event stores outcome, parent/root lineage, answer, evaluator result when applicable, previous mastery state, and timestamp. Diagnosis and History surface this lineage.

Mastery:
- `not_started`
- `developing`
- `needs_work`
- `provisional`
- `mastered`

A transfer pass is required for `provisional`. A due delayed-retrieval pass is required for `mastered`. Reviews use 7/14/30-day spacing after the latest transfer proof; relearning resets the spacing progression.

## Architecture

```
src/
  app/
    (app)/
    api/
    _components/
  lib/
    api.ts
    schemas.ts
    rewards.ts
  server/
    store.ts
    persistence.ts
    content.ts
    evaluator.ts
    calendar.ts
    schedule.ts
    tutor.ts
    converse.ts
    practice.ts
  test/
    demo-state.ts     # test-only legacy fixtures
    setup.ts
```

Server components read from `store` / `schedule`. Browser mutations go `lib/api.ts -> app/api/* -> store`. Keep that seam.

## Built

- Dashboard, course map, practice, diagnosis, dispute/clarification, lesson, transfer, result.
- Delayed review and Mastered/retention lifecycle.
- Evidence trail in diagnosis and evidence metadata in History.
- Review queue and spacing.
- General Tutor chat with images/PDFs, dictation and spoken mode.
- Upload check, voice answer flow, sketch/camera.
- Courses/to-dos/calendar/rank UI.
- iCal connection with SSRF protections.
- SQLite-backed local learner/calendar persistence.

## Known gaps

- Only CI interpretation and Standard Error are authored end-to-end.
- Course upload/concept extraction is still disabled.
- Transfer/review questions are hand-authored for the current concepts.
- Source retrieval/citations are not built.
- No multi-user auth.
- Hosted durable DB is not wired; SQLite is local persistence.
- Real Gemini/calendar/mic/camera need presentation-device smoke tests.
- Calendar scheduling uses server timezone and suggested blocks are not written back.
- End-to-end browser automation and production error/loading pages still need hardening.

## Rules to preserve

- Never mark Mastered from one immediate correct answer.
- Never demote on `uncertain`; only confirmed evidence changes mastery.
- Never silently fall back from a failed model call.
- Hand-ticking tasks and manually completing courses never earns mastery/rank evidence.
- Keep exact evidence lineage. Do not overwrite old attempts.
- Do not put sample/presentation data on `main`.
- Never commit `.env`, SQLite DB files, keys, calendar URLs or other secrets.

## Verification before merge

```bash
pnpm exec next typegen
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Also inspect the exact PR head against the latest `main` before merging.
