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

Model calls go through `src/server/ai.ts`. `OPENROUTER_API_KEY` (model `OPENROUTER_MODEL`, default `google/gemini-3.8-flash`) wins when set, otherwise `GOOGLE_GENERATIVE_AI_API_KEY`. Never read, print or commit `.env`.

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
- Practice hub (`/course/[id]/practice`): sample paper plus answer key and study notes as LaTeX-built PDFs (`tectonic`, local only), and an 8-question quiz with a score and review. Quizzes never change mastery or rank.
- Overall rank on the dashboard, and a rank per course on the same ladder (`getRewards(courseId?)`, `getCourseRanks()`).
- Browse courses (`/courses/browse`): five curated courses written as markdown in `content/courses/`. Adding one creates a runtime course (`CourseSpec`, persisted under `added_courses`). Runtime courses have a map, tutor, notes, paper and quiz, but no diagnose loop, because they have no authored questions or misconceptions.
- Course files upload (`/course/[id]/files`): md, txt, PDF and images become extra context (`server/materials.ts`). PDFs and images are read by the model.
- Course build pipeline (`server/courseJobs.ts`): uploading returns a job id at once and the build runs after the response, in four stages the modal shows (reading, topics, map, notes) with per-file status, a timer and Cancel. Typeset PDFs and text are read locally (`unpdf`, about 50 ms each). Only scans and images go to the model, in parallel, at low reasoning effort, with timeouts. Job state lives in SQLite so any server process can answer the poll. It replaced a pipeline that transcribed every PDF with the model, one at a time, which took minutes per file.
- Add a course: upload notes (markdown headings keep their structure, other notes go to the model for an outline), browse curated, or import from Granola or Wispr Flow.
- Granola and Wispr Flow: real MCP OAuth (dynamic client registration) in `server/integrations.ts`, per-user tokens in SQLite, a read-only import agent, connect and disconnect on the Account page. Connect was checked against both live servers up to the sign-in page. The callback and the import itself have not run, because they need real accounts.
- Accounts with Clerk (`src/proxy.ts`, `/sign-in`, `/sign-up`, `/account`). On only when both Clerk keys are set. Learning state is now scoped per account at server page/API boundaries.

## Known gaps

- Only CI interpretation and Standard Error are authored end-to-end.
- Courses added at runtime have no authored questions, so they skip the diagnose, teach and transfer loop. Generating those from notes needs grounding and review.
- Transfer/review questions are hand-authored for the current concepts.
- Source retrieval/citations are not built.
- Clerk identity now scopes learner state, runtime courses, calendar, materials and quizzes. Legacy global data stays local-owned; quiz sessions remain ephemeral. SQLite snapshots still do not provide multi-process write coordination.
- Curated course files are read from `content/courses` at runtime. A deploy must include that folder.
- PDF generation needs `tectonic` on the server, so it works locally and not on Vercel.
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

## User-scoped persistence milestone

`src/server/userBoundary.ts` wraps all API exports and application page components, plus AppShell (React renders nested server components separately). `src/server/userScope.ts` uses AsyncLocalStorage to retain trusted identity across asynchronous evaluation, and isolates account caches. An auth-enabled unscoped state access fails closed. `loadUserJson` / `saveUserJson` namespace learning/calendar/material keys; raw persistence functions remain available for existing per-user OAuth keys.

The no-auth `local` namespace keeps original keys and test reset hooks. Pre-auth global snapshots are not assigned to new accounts. Isolation tests cover concurrent grading/failure, account memory and reload state, foreign attempt/course/material/quiz access, rank and calendar, plus anonymous route rejection. No sample data is introduced on main.

## Concept learning spec architecture

`docs/concept-learning-spec.md` describes the versioned JSON contract in `src/lib/conceptLearningSpec.ts`. CI interpretation and Standard Error now have canonical validated specs in `src/server/authoredLearningSpecs.ts`. `content.ts` derives its legacy view from those specs; deterministic grader functions live separately in `authoredJudges.ts`. Existing mastery/evaluator behavior is preserved. Generated content, its persistence/revision lifecycle, generalized evaluation and runtime-course mastery remain subsequent milestones.
