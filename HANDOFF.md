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

- Dashboard, course map, practice, diagnosis, dispute/clarification, lesson, transfer, result.
- Delayed review and Mastered/retention lifecycle.
- Evidence trail in diagnosis and evidence metadata in History.
- Review queue and spacing.
- General Tutor chat with images/PDFs, dictation and spoken mode.
- Upload check, voice answer flow, sketch/camera.
- Courses/to-dos/calendar/rank UI.
- iCal connection with SSRF protections.
- SQLite-backed local learner/calendar persistence.
- Practice hub (`/course/[id]/practice`): sample paper plus answer key and study notes as LaTeX-built PDFs (`tectonic`, local only), and an 8-question quiz with a score and review. Answered quiz questions can start an unseen concept as Developing; they never diagnose, demote, prove mastery or award rank.
- Overall rank on the dashboard, and a rank per course on the same ladder (`getRewards(courseId?)`, `getCourseRanks()`).
- Browse courses (`/courses/browse`): five curated courses written as markdown in `content/courses/`. Adding one creates a runtime course (`CourseSpec`, persisted under `added_courses`). Runtime courses have a map, tutor, notes, paper and quiz. Source-grounded learning specs are generated on demand and drive diagnosis, targeted remediation, transfer and delayed review.
- Course files upload (`/course/[id]/files`): md, txt, PDF and images become extra context (`server/materials.ts`). PDFs and images are read by the model.
- Course build pipeline (`server/courseJobs.ts`): uploading returns a job id at once and the build runs after the response, in four stages the modal shows (reading, topics, map, notes) with per-file status, a timer and Cancel. Typeset PDFs and text are read locally (`unpdf`, about 50 ms each). Only scans and images go to the model, in parallel, at low reasoning effort, with timeouts. Job state lives in SQLite so any server process can answer the poll. It replaced a pipeline that transcribed every PDF with the model, one at a time, which took minutes per file.
- Test this concept is a conversation first (`SessionChat`, `server/session.ts`, `/api/session`). The tutor opens by asking what the student thinks, with no question on screen. It then agrees or corrects, teaches when asked, and asks the next question, and none of that is graded or changes mastery. "I don't know yet" makes it ask which part is confusing, with quick replies (an `OPTIONS:` line the screen parses), and "Teach me from scratch" makes it teach in small steps before asking questions. The graded question appears only when the student taps "Check what I've got" or accepts the tutor's offer, and from there the evidence flow runs unchanged (assess, follow-up, diagnosis, lesson, transfer). With ElevenLabs agent credentials, Speech mode runs the same tutor brief as a live WebRTC call and shares the transcript with chat; without them it falls back to the browser-recognition speech page. Voice conversation itself never changes mastery.
- Quiz evidence (`recordQuiz` in `store.ts`): finished quizzes are saved per user and reopen from History. Answered questions feed `recordQuizEvidence`; blanks supply no evidence. An unseen concept may become Developing, but quiz performance never diagnoses, demotes, proves mastery, schedules review or awards rank. Runtime course concept checks generate canonical content on demand.
- Paper, notes and quiz are written as 2 to 4 parallel model calls over disjoint concepts (`server/parallel.ts`), which is what brought a paper from 21 s to 7 s. Compile is 0.3 s.
- Add a course: upload notes (markdown headings keep their structure, other notes go to the model for an outline), browse curated, or import from Granola or Wispr Flow.
- Granola and Wispr Flow: real MCP OAuth (dynamic client registration) in `server/integrations.ts`, per-user tokens in SQLite, a read-only import agent, connect and disconnect on the Account page. Connect was checked against both live servers up to the sign-in page. The callback and the import itself have not run, because they need real accounts.
- Accounts with Clerk (`src/proxy.ts`, `/sign-in`, `/sign-up`, `/account`). On only when both Clerk keys are set. Learning state is now scoped per account at server page/API boundaries.
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

- live end-to-end browser/device smoke against the latest frontend (the repo-wide integration hardening pass is merged);
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

`src/server/userBoundary.ts` wraps all API exports and application page components, plus AppShell (React renders nested server components separately). `src/server/userScope.ts` uses AsyncLocalStorage to retain trusted identity across asynchronous evaluation, and isolates account caches. An auth-enabled unscoped state access fails closed. `loadUserJson` / `saveUserJson` namespace learning/calendar/material keys; raw persistence functions remain available for existing per-user OAuth keys.

The no-auth `local` namespace keeps original keys and test reset hooks. Pre-auth global snapshots are not assigned to new accounts. Isolation tests cover concurrent grading/failure, account memory and reload state, foreign attempt/course/material/quiz access, rank and calendar, plus anonymous route rejection. No sample data is introduced on main.

## Concept learning spec architecture

`docs/concept-learning-spec.md` describes the versioned JSON contract in `src/lib/conceptLearningSpec.ts`. CI interpretation and Standard Error now have canonical validated specs in `src/server/authoredLearningSpecs.ts`. `content.ts` derives its legacy view from those specs; deterministic grader functions live separately in `authoredJudges.ts`. Existing mastery/evaluator behavior is preserved. Generated content, immutable revisions, generalized evaluation and runtime-course mastery are implemented. Assessment clients send the displayed content revision; stale initial questions fail closed and clarification resumes on the pinned revision.

## Speech mode

`/course/[courseId]/practice/[conceptId]/talk` is a spoken two-way conversation with the same tutor as the chat. It shares the transcript with `SessionChat` through sessionStorage, so the student can switch both ways. Speech in uses the browser's recognition (silence for 1.6s ends a turn). Speech out goes through `/api/voice/speak`, which proxies ElevenLabs (`ELEVENLABS_API_KEY`, optional `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL`) and falls back to browser speech on a 501. Nothing is graded in speech mode; the check happens in the chat.
The deliberate frontend/backend integration pass landed in PR #14. Re-run focused hardening when teammate changes land on top of it rather than re-auditing stable subsystems from scratch.


## Rank ladder

Overall tiers start at 0 / 1,000 / 5,000 / 10,000 / 50,000 / 100,000 / 500,000 points (Bronze to Legend). Each course uses `courseTiers(conceptCount)`, at 0, 10, 25, 45, 70, 90 and 100% of the course mastery point budget. Quiz answers award no rank. The course map and dashboard use `CourseRankBar`. Historical peak totals remain preserved.

## Voice calls (ElevenLabs agent)

`/course/[courseId]/practice/[conceptId]/talk` runs a live WebRTC call with an ElevenLabs agent when `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` are set (`AgentTalk`, `@elevenlabs/react` 1.16.0). Without them it falls back to the older browser-recognition page (`TalkChat`). `/api/voice/session` keeps the key on the server, returns a conversation token, and sends the concept's tutor brief (`voiceBrief` in `server/session.ts`) as a prompt override plus the chat so far, so the call carries on from the chat. The agent needs Security overrides on for system prompt and first message. The transcript goes into the same sessionStorage thread as the chat, and nothing said on a call is graded. Not built yet: a voice picker in settings (override `tts.voiceId`).
