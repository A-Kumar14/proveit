# Mastery

Know what you actually know. The app finds the specific misconception behind a wrong answer, teaches only that gap, then tests it again with a different question before it raises mastery.

Loop: explain, diagnose, reteach, transfer test, update mastery.

## Run it

```bash
pnpm install
cp .env.example .env.local   # optional, see below
pnpm dev                     # http://localhost:3000
```

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

## Model calls

Set `GOOGLE_GENERATIVE_AI_API_KEY` to use Gemini for grading (3 independent checks vote), the upload check and the streamed mastery review. With no key, regex judges in `src/server/content.ts` cover the CI interpretation and standard error concepts so the demo path is repeatable. Uploads stay hidden without a key unless `NEXT_PUBLIC_DEMO_MODE=1`.

## Where things live

| Path | What |
| --- | --- |
| `src/server/store.ts` | In-memory data layer. The backend swap point: every exported function is what pages and routes call. Resets on restart. |
| `src/server/content.ts` | Hand-authored questions, misconceptions, lessons and transfer rubrics. |
| `src/server/evaluator.ts` | Gemini voting judges, with the heuristic fallback. |
| `src/lib/schemas.ts` | Zod contracts shared by routes and the client. |
| `src/app/api/*` | Route handlers: assess, clarify, transfer, mastery-review, upload/check, courses/complete. |
| `src/app/_components/*` | UI, grouped by shell, chat, mastery, practice, courses, upload, voice, settings. |
| `design-handoff` source | `mastery-ui-handoff.zip` holds the approved reference screens. |

## Not built yet

Course upload (the Add a course modal only opens the demo course), a free-text tutor chat, real persistence, and a way for a concept to reach Mastered after a delayed review. Anything unfinished is hidden or visibly disabled, not stubbed. See `CHECKLIST.md` for the full list.

The Linear Algebra course is sample data so the Completed group has something in it. A course is completed when you mark it on the Courses page, or when every concept is Mastered.
