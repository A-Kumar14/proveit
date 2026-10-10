# Handoff

Written for an AI coding agent (Cursor) picking this repo up mid-flight. Read this, then `README.md`, `CHECKLIST.md` and `AGENTS.md`.

## What this is

Mastery (repo name `proveit`). A study app that finds the specific misconception behind a wrong answer, teaches only that gap, then tests it again with a different question before it raises mastery. Loop: explain, diagnose, reteach, transfer test, update mastery. North star: never confuse showing the correct answer with proving the student understands it.

Hackathon project, 4 people. This repo is the frontend plus a stand-in backend. The owner works on UI and product; teammates own the real backend, data and AI evaluation.

- GitHub: https://github.com/A-Kumar14/proveit (private)
- Local path: `/Users/arsshkumar/ProveIt`
- Design source of truth: `mastery-ui-handoff.zip` (8 reference screens as HTML plus `UI_HANDOFF.md`). The zip has no `support.js`, so the references don't render. Compare against their markup.

## Run it

```bash
pnpm install
pnpm dev                                  # http://localhost:3000
PROVEIT_DATA=demo pnpm dev                # seeded demo data and sample courses (default is empty)
NEXT_PUBLIC_DEMO_MODE=1 pnpm dev          # shows demo upload items and the "Preview tier-up" button
pnpm typecheck && pnpm lint && pnpm test  # run all three before calling anything done
```

Env (see `.env.example`): `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` (OpenRouter wins when set, default `google/gemini-3.8-flash`), `GOOGLE_GENERATIVE_AI_API_KEY` (optional fallback), `GEMINI_MODEL` (optional, default `gemini-3.8-flash`), `NEXT_PUBLIC_DEMO_MODE`, `PROVEIT_DATA`. There is a local `.env` the owner edits. Do not read it, print it or commit it.

Restart the dev server after changing `src/server/store.ts`: state lives on `globalThis.__proveit`, so hot reload keeps stale seed data.

## Stack and version traps

- Next.js 16.4 App Router, React 19, Tailwind 4 (`@theme` tokens in `src/app/globals.css`), TypeScript strict, pnpm.
- Next 16 differs from older versions. `AGENTS.md` says to read `node_modules/next/dist/docs/` before writing Next code.
  - `cacheComponents` is turned OFF in `next.config.ts` on purpose. It breaks pages that read changing server state.
  - Page props use the generated `PageProps<"/route">` and `LayoutProps` types. Run `npx next typegen` after adding routes or tsc will say they're missing.
  - `params` and `searchParams` are promises.
- AI SDK v7 (`ai`, `@ai-sdk/google`, `@ai-sdk/react`). Structured output is `generateText` / `streamText` with `output: Output.object({ schema })`, not `generateObject`. Streaming to the client uses `createTextStreamResponse` + `toTextStream`, and the client uses `experimental_useObject`. Image input is a `{ type: "file", data, mediaType }` part.
- Tests: Vitest 5. Component tests use jsdom via a `// @vitest-environment jsdom` docblock plus Testing Library. `server-only` is aliased to a stub in `vitest.config.mts`.
- No tRPC (decided: the backend may be FastAPI, and streaming needs plain route handlers). Plain route handlers plus zod.

## Architecture

```
src/
  app/
    (app)/                  routes: / , /courses, /calendar, /review, /history, /settings,
                            /course/[id]/{page,tutor,practice/[conceptId],diagnosis/[attemptId],
                            lesson/[attemptId],result/[attemptId],misconceptions,files}
    api/                    assess, clarify, transfer, mastery-review, upload/check,
                            courses/complete, todos/complete, calendar/{connect,refresh,disconnect}
    _components/            shell, chat, mastery, practice, dashboard, courses, calendar, upload, voice, settings
  lib/                      schemas.ts (zod contracts), api.ts (browser fetch client), rewards.ts (tiers, points),
                            dates.ts, settings.ts (localStorage prefs), mastery.ts (state looks), cn.ts
  server/
    store.ts                THE BACKEND SEAM. In-memory data layer. Every exported function is what pages and
                            routes call. The real database replaces this file's internals.
    content.ts              hand-authored questions, misconceptions, lessons, transfer rubrics (2 concepts)
    evaluator.ts            Gemini grading (3 votes) with a regex fallback when no key is set
    calendar.ts             iCal fetch, parse, safe-URL checks, sample events, free-slot finder
    schedule.ts             merges calendar + course events, attaches suggested slots to tasks
    route.ts, page.ts       shared error mapping for routes, 404 helper for pages
    ai.ts                   key check and model
```

Pattern: server components call `store`/`schedule` functions directly for reads. Mutations go browser -> `lib/api.ts` -> `app/api/*/route.ts` -> `store`. Routes use `handle(req, zodSchema, fn)` from `server/route.ts`.

## What is built

- Course map (graph, units view, detail panel), practice, diagnosis (highlighted evidence), lesson, new-question transfer step, mastery-updated result with rank points.
- Tutor page is a general course chat (`/api/tutor`, streamed, images and PDFs, dictation, spoken mode, stop). "How am I doing?" drops in the mastery review card (numbers computed in code, AI text streams in). Chat history lives in the page only. Chatting never changes mastery.
- Upload check (rejects non-student work, never reaches grading). Voice mode (speech recognition, editable transcript, Sketch, Camera, Add file).
- Review queue, history, misconception log, course files, settings (answer mode, hints, read-aloud).
- Courses page: filters, row select, batch and right-click "Mark as completed", undo. Sidebar splits In progress and Completed.
- Dashboard, top to bottom: Rank card, Courses ticker (scrolls left to right, pausable), To-do list (read-only, finishes from progress, hand-tick with confetti) beside a Calendar card.
- Calendar: month view, connect any iCal link (Google/Apple/Outlook), Refresh, sample events until connected, suggested study slots from free gaps, review queue times.
- Rank: 7 tiers (Bronze to Legend, each step asks 500 more points). Points come only from evidence. Tier-up celebration plays when the tier is higher than last seen.
- Tests: about 111 passing (store, evaluator voting, calendar, routes, several components).

## Rules the code enforces (keep them)

- A concept becomes Provisional only after a passed transfer question. Hand-ticking a task or marking a course done never changes mastery.
- A course is completed when marked by hand, otherwise when every concept is Mastered and it has at least one concept.
- Rank points are derived from current evidence, with a once-per-concept cap on repaired and first-try bonuses, and a peak so rank never drops. Hand ticks and hand-completed courses earn nothing.
- Without an AI key the app uses deterministic regex judges so the demo path repeats. With a key, grading runs 3 independent checks and a split becomes "uncertain". Model failures surface as a retry state, never a silent fallback.
- Calendar fetches: https only, no private or loopback addresses, redirects re-checked, 2 MB cap. The feed URL is never returned to the browser.
- Anything unfinished is hidden or visibly disabled, not faked.

## Known gaps (full list in `CHECKLIST.md`)

- Nothing has been run against a real Gemini key, a real calendar link, or a real microphone and camera. Mocked tests only.
- Only 2 concepts (CI interpretation, Standard error) run end to end. Others show "Not in the demo yet".
- Linear Algebra (completed) and Personal Finance 101 are sample courses: viewable, not practicable. They also inflate starting rank points (demo starts at Platinum, 6,000).
- No path from Provisional to Mastered (delayed review does nothing yet).
- Persistence is in memory. Peak points live in server memory, the celebrated tier in localStorage.
- Calendar uses the server's time zone. Study blocks are suggestions only, not written to the student's calendar. No Google OAuth, only the iCal link.
- Course upload and a free-text tutor chat are not built.
- No end-to-end test, no `error.tsx` / `loading.tsx`, no rate limiting, no real auth (one hard-coded demo user).

## Branches (state as of this handoff)

`main` = `899604a`. Everything after it is on stacked, unmerged branches:

`main` -> `feat/dashboard-redesign` (91d3925) -> `feat/todo-and-calendar` (7cfb5ff) -> `feat/rank-tiers` (127b0cf, current, has all work). Older branches (`feat/initial-ui`, `feat/sidebar-completed-courses`, `feat/courses-page`) are already in `main`.

To land everything: fast-forward `main` to `feat/rank-tiers` (`git checkout main && git merge --ff-only feat/rank-tiers && git push origin main`). The owner asked for merges to be a deliberate step, so confirm first.

## Working agreements (from the owner's global instructions)

- Terse replies. No preamble or wrap-up summary. No em dashes, no colon connectors mid-sentence, sentence-case headings, plain words. Push back if an approach is wrong.
- Plan first on non-trivial work. Trivial fixes: just do them and report.
- Done means typecheck, lint and tests all pass, and you ran them.
- Write tests for new logic. Match the repo's framework and layout.
- Git: feature branches, never force-push or rewrite pushed history, Conventional Commits, one logical change per commit, scan for secrets before every commit, no AI attribution trailer in commits. Never commit `.env`.
- pnpm, TypeScript strict, ESLint + Prettier. Flag any new dependency and why.
- Lint rules that bite here: `react-hooks/set-state-in-effect` (don't call setState synchronously in an effect, defer with a timeout or derive it) and `react-hooks/refs` (don't write refs during render).
- Vitest quirk: `mockRejectedValue` on a `generateText` mock was reported as an unhandled error. Throwing from inside the resolved value's getter worked.

## Good next steps

1. Run the whole loop with a real Gemini key in `.env.local` and fix what breaks.
2. Author 3 to 4 more concepts in `src/server/content.ts` (question, misconception, lesson, transfer rubric).
3. Wire a passed review to promote Provisional to Mastered, and mark its review task done.
4. Swap `store.ts` internals for the real database, keeping the exported function signatures.
5. Tune rank points and thresholds; exclude sample and seeded courses from points.
6. Add an end-to-end test of the demo path, plus `error.tsx` and `loading.tsx`.
