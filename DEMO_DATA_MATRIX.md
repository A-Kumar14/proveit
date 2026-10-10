# Demo data matrix

This branch seeds sample data for the product surfaces below. The goal is one coherent learner story, not unrelated mock cards.

| Surface | Seeded data |
| --- | --- |
| Dashboard | Mixed mastery, open misconception, recently caught misconceptions, rank/streak, active courses |
| Rank | 6,000+ peak points, tier progress, tier-up preview |
| Courses | Intro Statistics, completed Linear Algebra, in-progress Personal Finance |
| Course map | Mastered, developing, needs-work, provisional and not-started nodes |
| Practice | Authored CI interpretation and Standard Error questions |
| Uncertain follow-up | Attempt `a6` on CI construction has a valid clarification prompt |
| Diagnosis | Attempt `a1` shows the open Parameter probability trap |
| Lesson | `a1` opens the focused CI interpretation remediation |
| Transfer/result | `a2 -> a3` is a repaired Standard Error episode with a passed transfer |
| Delayed review | Standard Error is provisional and due now |
| Review result | `a5` is a retained Population-vs-sample review pass |
| Misconception log | CI trap open, Standard Error misconception repaired |
| History | Incorrect, correct, transfer-pass, review-pass and uncertain evidence events |
| Evidence trail | `a2 -> a3` shows diagnosis-to-transfer lineage |
| Review queue | Due Standard Error review plus active started concepts |
| To-do | Progress-completed, hand-completed and open work across courses |
| Calendar | Demo calendar with class, office hours, job shift, seminar and study group |
| Course files | OpenStax source on Intro Stats and sample syllabi on sample courses |
| Upload menu | Student-work example and rejected lecture-slide example |
| Voice | Uses the same seeded upload examples and authored questions |
| Tutor | Real tutor UI over the seeded course/mastery context; model text is still live when a key exists |
| Add course | Demo Intro Statistics entry point; real ingestion remains disabled |
| Reset | Dashboard **Reset demo** restores learner/calendar sample databases to this canonical state |
| Settings | No fabricated personal settings; controls remain normal app preferences |

## Canonical seeded evidence IDs

- `a1`: CI interpretation, confirmed misconception, open diagnosis
- `a2`: Standard Error, confirmed misconception
- `a3`: Standard Error transfer pass, repaired and provisional
- `a4`: Sampling variability correct answer
- `a5`: Population vs. sample delayed-review pass, retained/mastered
- `a6`: CI construction uncertain answer, valid follow-up path

Keep these IDs stable unless the demo flow itself changes, because screenshots/tests may point to them.
