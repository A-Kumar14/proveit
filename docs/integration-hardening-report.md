# ProveIt integration hardening

## Scope and source of truth

Audited the current application across frontend, API, learning engine and persistence. Started from `32f34353888f062f0963bcc5b30be45ba811127d`; incorporated teammate rank work through `3643c89993f3e04fb8d74717181517b90a2945fe` on `anirudh/integration-hardening`. No changes were merged into main. No architecture redesign, sample-data merge, new AI provider or new ElevenLabs integration was introduced.

The full suite exercises account boundaries, generated specs, revision storage, grading, diagnosis, transfer, review, quizzes, materials, ingestion jobs, curated courses, calendars, todos, ranks, Tutor streams, speech text, accessibility and integration routes. Passing mocked tests does not establish live provider/device behavior.

## Changes and reasons

1. **Runtime learner-image checks:** removed the global authored-concept lookup from `/api/upload/check`. The multipart request now carries course and concept identity; the server resolves the canonical question in the authenticated user's course. Updated the shared client, file picker, typed practice and legacy voice upload paths. Unknown/foreign course IDs fail closed; generated concepts with saved specs are supported. Model error messages support both configured providers. Tests cover missing course identity, unknown courses, invalid files, unavailable models and generated concepts.
2. **Account transcript isolation:** typing and speech share a versioned key derived from server-supplied user/course/concept identity. Legacy unscoped transcripts are not restored. Server pages supply trusted identity and key the conversation by account. Regression verifies that another account's transcript and legacy shared transcript cannot appear. Backend account isolation remains unchanged.
3. **Quiz semantics:** the quiz page now records answered MCQs through `recordQuizEvidence`, instead of maintaining a second stronger state-transition path. Answered questions may start an unseen concept as Developing; blanks contribute no evidence. Quiz misses cannot demote concepts, name misconceptions, close remediation, schedule reviews or establish Provisional/Mastered. Quiz answers award no rank. Quiz UI, Tutor instructions and conflicting tests now agree with these rules. The generated-course regression inserts a quiz into an active diagnosis episode and then successfully completes transfer, delayed review and persistence reload.
4. **Source lineage UI:** connected the existing projection component to assessment questions, conversational checks, targeted lessons, transfer challenges, delayed review and evidence trails. Evidence displays its pinned content revision and saved excerpts. Authored references remain explicitly labeled metadata references, with no invented excerpt. A render regression checks the distinction and pinned revision.
5. **Displayed assessment revision:** question views expose their learning-spec revision; typed practice, conversational checks and legacy voice assessment send it. A mismatched displayed revision is rejected before grading instead of judging a response to an old question against a different current spec. Clarification page resumes the parent revision and verifies both course and concept. Optional revision inputs preserve compatibility for existing callers; new UI submissions carry the guard.
6. **Course removal / quiz reuse:** removal clears persisted quiz audits as well as learning attempts/material/spec cleanup already performed by the course service. In-memory quizzes retain the original course instance; generation and submission reject replaced courses even if a slug is reused. Old completed and pending quizzes cannot affect a replacement course or resurrect its old audit. Regression covers remove, re-add and stale submission.
7. **Course removal / file ingestion:** an asynchronous material read captures its original course instance and verifies it again before saving. Removing and re-adding the same slug cannot redirect an in-flight private file into the replacement course. Regression covers this race.
8. **Recoverable page failures:** added the current Next.js error boundary contract with retry and return-to-courses actions. Model/page failures no longer leave students without a recovery action; server error details are not rendered.
9. **Teammate rank integration:** retained the newly pushed overall thresholds, per-course ladder, dashboard bar and course-map rank UI. Removed quiz points from the course-tier budget, since quizzes supply weak evidence. Updated tier regressions to match that budget. Existing stored peak totals are preserved.
10. **Documentation/copy:** corrected stale runtime-course, quiz and future-milestone descriptions in HANDOFF. Removed Gemini-only configuration copy from the unavailable Tutor UI. Kept existing teammate speech and accessibility functionality.

## Verification

All required commands passed on the final code snapshot:

| Check | Result |
| --- | --- |
| `pnpm exec next typegen` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass |
| `pnpm test` | 507 tests, 71 files passing |
| `pnpm build` | Pass |
| `git diff --check` | Pass |

The build emits an existing CSS optimizer warning for `::highlight(read-aloud-word)`. This is a valid browser highlight feature; its actual device behavior remains to be checked. Local HTTP startup also emits Clerk's existing `createRouteMatcher` deprecation notice; trusted page/API boundaries remain in place.

Production HTTP smoke passed 25 requests using isolated test state: dashboard, courses, catalog, calendar, review queue, history, account, settings, authored practice, assessment, diagnosis, transfer page, transfer pass, early review rejection (409), curated course add, course/files/Tutor pages, quiz start and submission with zero points, course removal/re-addition, stale quiz rejection (404), and practice notes with downloadable LaTeX. No test state or database was committed.

The generated-course model-mocked regression covers source-grounded generation → confirmed diagnosis → remediation → intervening weak quiz → transfer → Provisional → delayed review → Mastered → persistence reload, with foreign-account reads rejected. Live model correctness is not established by this test.

Browser inspection was attempted, but the cloud browser could not reach the local server (connection refused). Local production HTTP checks and component render tests passed; no live browser click-flow claim is made.

## Remaining checks and teammate discussion

- **Credentials/device checks:** actual Gemini/OpenRouter generation and streaming, Clerk sign-in/account switching, Granola/Wispr OAuth callback plus real import, a real iCal feed, and microphone/camera/speech playback require configured accounts or devices. Route/service tests cover plumbing; these live checks remain open.
- **Existing ElevenLabs code:** latest main already contained `/api/voice/speak` and its client fallback. This pass preserved that teammate code and added no ElevenLabs functionality or credentials. Confirm with the team whether that pre-existing route should be enabled for the demo.
- **Rank policy:** the recent teammate patch counted quiz points in the per-course ladder. This branch follows the explicit product contract that quizzes award none. Confirm that the team agrees on that contract before merging. Previously persisted peak points are intentionally retained; no historical rank migration was attempted.
- **Course deletion policy:** deleted courses now lose their quiz audits alongside their other course evidence. Restoration/versioned archival is outside the existing architecture. UI deletion still needs a device smoke check.
- **PDF tooling:** `tectonic` is absent in this environment. Practice generation returned usable `.tex` with an explicit PDF error; PDF rendering itself remains unverified. Configure the compiler on the demo machine or demonstrate the source download fallback.
- **Hosted persistence:** SQLite/local material storage and background ingestion still require a deployment with durable writable storage and sufficient job duration. No hosting/storage adapter redesign was attempted.
- **Saved conversation lifecycle:** account transcripts are isolated, but same-account old conversation cleanup after course removal or material changes remains a convenience-layer follow-up. Server assessment revision checks prevent stale initial content from being silently graded.
- **Generated content guarantees:** source/schema validation establishes stored traceability; it does not prove that every generated sentence is entailed by its excerpts. Live content/pedagogy inspection remains necessary.
- **Session portability:** in-progress quizzes remain process-local and may need restarting after a server restart or worker change. Completed quiz audits persist. Calendar study slots remain suggestions, not writes to the external calendar.
- **Remote CI:** local checks above are verified. Inspect the exact final PR head's GitHub Actions result before merging; local success is not a substitute for remote CI.

## Review order

Review the course-scoped upload patch first, then the account/evidence/revision/removal integration patch and incorporated teammate rank update, then the material-race guard and report. Keep PR #5/sample seed data out of main. No merge was performed.


## Post-merge continuation

PR #14 was merged into `main` at `b8ebb719e82a6c8e2990e603b02606fc1464c2ad`. The next three `main` commits added the live ElevenLabs agent speech path and adjusted the session UI, so the hardening pass was resumed from that exact delta rather than re-auditing already-merged subsystems.

Focused review of the new voice path verified these preserved boundaries:

- `/api/voice/session` is wrapped by the trusted user route boundary and resolves the current course/concept before issuing a short-lived ElevenLabs token;
- the API key stays server-side;
- the per-call prompt is built from the same user-scoped course/spec/material context as Tutor chat;
- voice transcripts reuse the account/course/concept-scoped browser thread introduced by PR #14;
- voice conversation remains explicitly non-grading and cannot directly change mastery, evidence, review scheduling or rank;
- replaced/removed courses fail through current question resolution rather than reviving stale concepts;
- prompt and first-message overrides are checked before the token request when the agent configuration can be read.

This continuation also hardened the client start path for demo reliability: microphone permission is requested before spending a voice token, permission denial surfaces a direct recovery message, and SDK errors clear the local connecting lock so the student can retry instead of being stuck in "Connecting...". Regression tests cover blocked microphone access and retry after a reported SDK connection failure.

The live provider/device checks below are still environment-dependent; passing mocked tests cannot prove microphone hardware, WebRTC network traversal, ElevenLabs account configuration or real model quality.
