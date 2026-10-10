# UI handoff

Session work on top of `HANDOFF.md`. Read that first for the product, the stack traps, and the working agreements. This file is only the uncommitted UI that landed after commit `9fe4741`.

Nothing here is committed. Branch `feat/rank-tiers` tracks `origin/feat/rank-tiers` at `9fe4741`. Leave the commit until the owner asks. Merges to `main` stay a separate confirmed step.

## What the owner wants

Layout only. Widgets are the unit of the course page. Status color stays green, amber, and red on the existing white and Inter theme. No dark maps, cyan, gradients, glows, or dot grids. React Bits and 21st.dev were looked at and rejected as dependencies. The trunk shape was copied locally.

## Course page

`src/app/(app)/course/[courseId]/page.tsx`

Clicking a course in the sidebar opens that course. No chat prompt. Crumbs are the course name, and the right side is the quiz deadline.

Order on the page:

1. `CourseMapCard` (the map).
2. A two-column grid of `TutorPanel`, `PracticePanel`, `MisconceptionPanel`, `FilesPanel` from `src/app/_components/course/CoursePanels.tsx`.

Those four used to appear as extra sidebar links after a course was selected. That block is gone from `src/app/_components/shell/Sidebar.tsx`. The course row highlights from `courseId`, not from the active nav key. `Sidebar.test.tsx` checks that Tutor, Misconception log, and Course files are absent from the sidebar HTML.

The tutor, practice, diagnosis, lesson, result, misconceptions, and files routes still exist. The panels link to them. Leave those routes.

## Course map

`src/app/_components/mastery/CourseMapCard.tsx` is a client component. It is a vertical trunk of units. Each concept sits on a branch off a left rail. Selected concept uses an ink border and an ink tick. Footer shows the selected name, the `LOOK` pill, the description, and the concept call to action. The legend lists all five states.

`Widget` (`src/app/_components/dashboard/Widget.tsx`) gained two optional props. `heading` makes this card's title a 16px semibold header. `aside` holds the filter. Every other widget still uses the uppercase eyebrow. Keep it that way.

Filter, default `remaining`:

- Completed means `state === "mastered"` only.
- Remaining is everything else, including provisional.
- Units with no concepts in the current filter are omitted.
- If the selected concept is hidden, the footer moves to the first visible concept.
- Empty copy: "Nothing left in this course." and "Nothing completed yet."
- The line under the title is "N left" or "N completed".
- The count on a unit heading is how many concepts that unit shows in the current filter.

Intro Statistics on 2026-10-10 shows 7 left. CI interpretation stays selected because it is `nextUp`.

`ConceptGraph.tsx`, `ConceptNode.tsx`, and `UnitsView.tsx` are unused by the course page. They were left in place. The graph was made responsive and then replaced. Do not delete them unless asked.

## Review queue

The queue was empty because seed data sets `nextReview` to null, so `getReviews` returned nothing. It is now a priority queue from the calendar.

`src/server/schedule.ts` exports `getReviewQueue(now = new Date())`. `src/app/(app)/review/page.tsx` renders it.

Order:

1. Due spaced reviews, with `eventStart` at the start of today.
2. Upcoming reviews on their day.
3. Open practice tasks (`kind === "practice"`) tied to the soonest quiz in 21 days for that course, otherwise the soonest class whose title matches the course name or its first two words.

Sort by `eventStart`, then state rank: needs work, developing, provisional, not started. The first three rows get `suggestSlots`. Reviews for completed courses are dropped through `listCourses`. `QueuePressure` is `"review" | "quiz" | "class"`.

`ReviewItem` in `src/server/store.ts` now includes `day`, the ISO day of `nextReview`.

`src/server/reviewQueue.test.ts` pins this with `now = new Date(2026, 9, 10, 8, 0)`. Expected open ids: cii, var, se, cic, nul, pv, err, pf-dbt, pf-idx, pf-tax, pf-ret. `pf-cmp` is provisional, so it is already done in todos and stays out. The first row is quiz pressure for CI interpretation. Finance practice has a null href because its quiz is Fri Oct 23 and is not practicable. After assess plus submitTransfer on cii, with `nextReview` set to 2026-10-10, the first row is `review:cii` and the cii practice row is gone. `setCoursesCompleted` on intro-stats drops every Intro Statistics row.

The review page is a two-column layout, queue plus a "Coming up" aside of the next 7 days. Quizzes after that week sit under "Quizzes after this week".

Restart the dev server after any further `store.ts` change. State lives on `globalThis.__proveit`.

## Checks

Last full suite during this work was 114 passing, before the map filter. After the filter, eslint was clean on `CourseMapCard.tsx` and `Widget.tsx`. Typecheck and the full suite were not re-run after that last edit. Run `pnpm typecheck && pnpm lint && pnpm test` before calling the work done.

Dev server was already on port 3000. A second `pnpm dev` fails with the port in use.

Browser clicks in Cursor's browser often focus a button without running the React `onClick`. The Remaining view was confirmed on `/course/intro-stats` from the server render: bold "Course map", "7 left", mastered concepts hidden. Confirm Completed with a real click in the owner's browser.

## Left alone

- No new dependencies.
- `.env` was not read or changed.
- Subpages still use the chat layout.
- Only CI interpretation and standard error are practicable. Other concepts stay "Not in demo."
