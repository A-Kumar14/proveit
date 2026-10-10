# Project checklist

Status as of the last push to `main`. Tick items as they land.

## Before a demo

- [ ] Put a Gemini key in `.env.local` and restart the dev server
- [ ] Run the full loop with the key on: answer, diagnosis, lesson, transfer, result
- [ ] Check the three-check grading gives sensible votes on the demo answer
- [ ] Check the Tutor review streams and the skeleton clears
- [ ] Check the upload check accepts a photo of real work and rejects a lecture slide
- [ ] Check Sketch and Camera send a frame through the upload check
- [ ] Check voice mode with a real mic: speech, mute, End and review, edited transcript
- [ ] Replace the in-memory store with the real database behind the same functions in `src/server/store.ts`
- [ ] Add a demo reset (button or endpoint) so state can clear without a restart
- [ ] Lock one deterministic demo path and rehearse it
- [ ] Deploy (Vercel) and confirm state survives between requests
- [ ] Click through every screen in a real browser on the presentation laptop

## Content

- [ ] Author question, misconception, lesson and transfer rubric for each remaining concept (target 8 polished)
- [ ] Standard error: click through the full loop once
- [ ] Add a second misconception to the concepts that have more than one common error

## Product gaps

- [ ] Generate transfer questions dynamically and validate they test the same concept
- [ ] Promote Provisional to Mastered when a delayed review passes
- [ ] Make the Review queue's "Review now" run a real review attempt
- [ ] Let the evaluator return procedural errors and slips, not only conceptual ones
- [ ] Add source retrieval and citations so "Rule from course material" points at real text
- [ ] Have the model word the lesson, then show the "Wording by AI" tag
- [ ] Build course upload and concept extraction (the Add a course modal is disabled)
- [ ] Make the sample Linear Algebra course real, or remove it before the demo (it is placeholder data)
- [ ] Let the store run practice for more than one active course (only Intro Statistics is practicable)
- [ ] Decide on the free-text tutor chat (needs a chat backend), or leave it out

## Handoff done-checklist

- [ ] Compare each screen side by side with its reference (restore `support.js` or compare against the markup)
- [ ] Check colors, spacing, type sizes and strings match
- [ ] Confirm no dark backgrounds, cyan, gradients, glows or dot grids
- [ ] Confirm only Inter is loaded
- [ ] Demo path clicks through: Dashboard, Course map, Practice, Diagnosis, Lesson, New question, Result
- [ ] Off-topic upload is refused and never reaches evaluate
- [ ] Tutor review shows computed numbers at once and streams the AI text
- [ ] Repeated runs with the same data show identical numbers
- [ ] Keyboard focus is visible on every button, link and graph node
- [ ] Icon-only buttons all have an `aria-label`
- [ ] `prefers-reduced-motion` stops the ripple, wave and shimmer

## Responsiveness

- [ ] Check 1280 and 1440 wide laptop viewports for overflow and cropping
- [ ] Fix fixed widths that break (500px graph column, 600px show panel, 640px transcript card)
- [ ] Decide whether phone width matters for the demo

## Hardening

- [ ] Add an end-to-end test of the demo path
- [ ] Add `error.tsx`, `loading.tsx` and a styled `not-found.tsx`
- [ ] Stop trusting the browser-supplied `imageSummary` in `/api/assess`
- [ ] Rate limit the model routes
- [ ] Add auth beyond the hardcoded demo user (after the hackathon)

## Team

- [ ] Add the three teammates as collaborators on the GitHub repo
- [ ] Agree the API contract for the real backend
- [ ] Agree the LLM and provider (the code assumes Gemini)
- [ ] Log the "route handlers, no tRPC" decision in the vault's Decisions Log
- [ ] Decide the branch and merge flow from here (PRs, or straight to `main`)

## Done

- [x] Dashboard, course map, practice, diagnosis, lesson, transfer and result screens
- [x] Review queue, history, misconception log, course files and settings pages
- [x] Add a course modal with the demo course
- [x] Gemini voting grader with a deterministic fallback
- [x] Streaming Tutor review
- [x] Upload check with the "not your work" rejection path
- [x] Voice mode with transcript review, Sketch, Camera and Add file
- [x] Store, evaluator and upload route tests (23)
- [x] Courses page with filters, row selection, batch and right-click "Mark as completed"
- [x] Sidebar splits courses into In progress and Completed, with a sample completed course
- [x] Repo on GitHub, `main` up to date
