# Stage demo

Branch `demo/stage`. Seeded sample data only, never merged into `main`.

Run it on its own database, so your real data stays untouched:

```bash
pnpm stage            # builds, then runs on .data/stage.sqlite (fast, use this on stage)
pnpm dev:stage        # same data, dev mode (slow first visits)
```

Top right, **Reset demo** puts everything back to the starting state below. Use it before going on stage.

## Starting state

- Overall rank Gold, 9,777 points, 223 under Platinum. Intro Statistics is Gold at 2,977, 263 under its Platinum. Passing the CI interpretation question earns about 320, which tips both.
- Intro Statistics has an open misconception on **CI interpretation** ("Parameter probability trap") and one on Standard error.
- A review is due today (Standard error). One quiz is saved in History (4 of 6) with its audit.
- Linear Algebra is complete (Legend). Personal Finance is partly done.
- Calendar has classes, a shift and an Intro Statistics quiz on Thursday.

## Two-minute path

1. **Dashboard.** Point at the rank card and the course ranks. "Intro Statistics is 263 points from Platinum, and the whole account is 223 away."
2. **Intro Statistics map.** CI interpretation is red. Tap **Test this concept**.
3. **Conversation.** Say the common wrong idea: "There's a 95% probability the true mean is in my interval." The tutor corrects it kindly. Say "I don't know yet" once to show the guided help.
4. **Talk it through.** Tap the voice button, allow the microphone, and carry on by voice. Interrupt the tutor mid-sentence. Hang up and show the transcript in the chat.
5. **Check what I've got.** Answer the graded question, read the diagnosis, and finish the new-question test. Passing it tips Intro Statistics and the whole account into Platinum, and the tier-up celebration plays.
6. **History and quiz audit.** Show the saved quiz and how it separates "right" from "weak".

## Needs before going on stage

- `OPENROUTER_API_KEY`, `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` in `.env`. Without a model key the conversation falls back to the fixed question.
- Allow the microphone in the browser once, ahead of time.
- Run a full practice pass the day before. The model calls take a few seconds each.
