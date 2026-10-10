# Demo/sample-data database branch

This branch intentionally contains fabricated presentation data. **Do not merge this seed behavior into `main`.**

It uses a separate local SQLite file:

```
.data/proveit-demo.sqlite
```

On the first server read, the branch seeds that database with a coherent demo learner state. The seed covers:

- Intro Statistics mastery across mastered, developing, provisional, needs-work and not-started states
- an open CI-interpretation misconception with evidence
- a repaired Standard Error misconception plus a due delayed review
- an additional correct assessment event
- History/evidence-lineage rows
- a 3-day evidence streak and starting rank history
- manual to-do state
- completed Linear Algebra and in-progress Personal Finance sample courses
- a connected “Demo calendar” with classes, work, office hours and study-group events
- upload-menu examples for student work vs. a lecture slide
- add-course demo entry point
- rank-tier celebration preview

Real Gemini behavior is still used when a model key is present. The hard-coded assessment/transfer fallbacks remain available for the two authored concepts.

## Reset the demo

Stop the dev server, delete:

```
.data/proveit-demo.sqlite
.data/proveit-demo.sqlite-shm
.data/proveit-demo.sqlite-wal
```

and restart. The database will seed itself again.

## Data rule

The corresponding production/default branch deliberately starts with rank 0, no fabricated learner progress, no sample courses, no sample calendar events and no sample upload answers. This branch exists only for rehearsals, screenshots and deterministic presentation flows.
