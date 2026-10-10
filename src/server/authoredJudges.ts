import "server-only";

export type AnswerSeed = {
  verdict: "correct" | "incorrect" | "uncertain";
  quote: string | null;
  misconceptionId: string | null;
};
export type TransferSeed = {
  verdict: "pass" | "fail" | "uncertain";
  quote: string | null;
  misconceptionId: string | null;
  feedback: string | null;
};
export type AuthoredJudges = {
  assessment: (answer: string) => AnswerSeed;
  transfer: (answer: string) => TransferSeed;
  review: (answer: string) => TransferSeed;
};

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const firstMatch = (s: string, res: RegExp[]) => {
  for (const re of res) {
    const m = re.exec(s);
    if (m) return m[0];
  }
  return null;
};

const ciWrong = [
  /(?:a\s+)?95\s*(?:%|percent)\s*(?:probability|chance|likelihood)[^.!?]*/i,
  /probability[^.!?]*?95\s*(?:%|percent)[^.!?]*/i,
];
const rejectsCiProbability = (s: string) =>
  /(?:does\s+not|doesn't|do\s+not|don't|not)\s+(?:(?:mean|have)\s+)?(?:that\s+)?(?:there(?:'s|\s+is)\s+)?(?:a\s+)?95\s*(?:%|percent)\s*(?:probability|chance|likelihood)/i.test(s) ||
  /(?:there(?:'s|\s+is)\s+|(?:it|interval|range)\s+(?:has|have)\s+)?no\s+95\s*(?:%|percent)\s*(?:probability|chance|likelihood)/i.test(s);

// Authored-only offline heuristics. Never serialize these into generated learning specs.
export const AUTHORED_JUDGES: Record<string, AuthoredJudges> = {
  cii: {
    assessment: (answer) => {
      if (words(answer) < 6) return { verdict: "uncertain", quote: null, misconceptionId: null };
      const quote = firstMatch(answer, ciWrong);
      if (quote && !rejectsCiProbability(answer)) return { verdict: "incorrect", quote, misconceptionId: "parameter_probability_trap" };
      const explainsMethod = /(method|procedure|process|repeat|many (samples|studies)|long run|intervals)/i.test(answer);
      const explicitCorrection = /(method|procedure|long run|repeat)/i.test(answer) && /(not|rather than|instead of)[^.!?]*(one|single|this)[^.!?]*interval/i.test(answer);
      const ok = (/95/.test(answer) && explainsMethod) || explicitCorrection;
      return { verdict: ok ? "correct" : "uncertain", quote: null, misconceptionId: null };
    },
    transfer: (a) => {
        // Check the complete rubric first so a correct phrase such as "no 95% chance" is not
        // mistaken for the misconception merely because it contains the words "95% chance".
        const quote = firstMatch(a, ciWrong);
        if (quote && !rejectsCiProbability(a)) return { verdict: "fail", quote, misconceptionId: "parameter_probability_trap", feedback: "For one already-calculated interval, don't assign a 95% probability to the fixed mean." };
        const pass = /\b95\b/.test(a) &&
          /(either (contains|contain|does|is)|already (been )?(calculated|computed|built)|no (95\s*%|probability|chance)|not (a )?95\s*%|describes? the (method|procedure)|the method|long.?run)/i.test(a);
        if (pass) return { verdict: "pass", quote: null, misconceptionId: null, feedback: null };
        return { verdict: "uncertain", quote: null, misconceptionId: null, feedback: "Answer both parts: the long-run count out of 100, and what the 95% means for one interval after it is calculated." };
      },
    review: (a) => {
        const quote = firstMatch(a, ciWrong);
        const explicitlyRejectsProbability = rejectsCiProbability(a);
        // A contradictory answer still fails even if it also calls some other part of the report "wrong".
        if (quote && !explicitlyRejectsProbability) return { verdict: "fail", quote, misconceptionId: "parameter_probability_trap", feedback: "The true mean is fixed once the interval is calculated; focus on what the 95% says about the repeated method." };
        const rejectsClaim = explicitlyRejectsProbability || /\b(?:invalid|wrong|incorrect|misleading|not valid|not correct)\b/i.test(a);
        const method = /(method|procedure|long.?run|repeat|repeated|many (?:samples|studies|intervals))/i.test(a);
        const pass = /\b95\b/.test(a) && rejectsClaim && method;
        return pass
          ? { verdict: "pass", quote: null, misconceptionId: null, feedback: null }
          : { verdict: "uncertain", quote: null, misconceptionId: null, feedback: "Say whether the report's probability claim is valid, then explain what 95% describes over repeated samples." };
      },
  },
  se: {
    assessment: (answer) => {
      if (words(answer) < 6) return { verdict: "uncertain", quote: null, misconceptionId: null };
      const quote = firstMatch(answer, [
        /(?:larger|bigger|higher|more)\s+(?:sample|n\b)[^.!?]*?(?:larger|bigger|higher|more)\s+(?:standard error|se\b|error)[^.!?]*/i,
        /(?:standard error|se)\s+(?:is|gets|grows|increases)[^.!?]*?(?:larger|bigger|higher|more)[^.!?]*/i,
      ]);
      const rejectsMoreError =
        /(?:does\s+not|doesn't|not)\s+(?:mean\s+)?[^.!?]{0,50}(?:larger|bigger|higher|more)\s+(?:standard error|se\b|error)/i.test(answer) ||
        /(?:standard error|se)\s+(?:does\s+not|doesn't|is\s+not|isn't)\s+(?:larger|bigger|higher|more)/i.test(answer);
      if (quote && !rejectsMoreError) return { verdict: "incorrect", quote, misconceptionId: "more_data_more_error" };
      const ok = /(smaller|lower|less|shrink|decrease)/i.test(answer) && /(400|larger|bigger|more)/i.test(answer);
      return { verdict: ok ? "correct" : "uncertain", quote: null, misconceptionId: null };
    },
    transfer: (a) => {
        // Check the complete rubric before misconception phrases so "n is four times larger"
        // cannot be misread as "standard error is larger" in an otherwise correct explanation.
        const pass = /(half|1\s*\/\s*2|halve|divided by 2|factor of 2|2\s*x|two times)/i.test(a) && /(square root|sqrt|√)/i.test(a);
        if (pass) return { verdict: "pass", quote: null, misconceptionId: null, feedback: null };
        const wrong = firstMatch(a, [
          /(?:standard error|se)\s+(?:(?:is|gets|becomes|will be)\s+)?(?:double|doubles|twice|increase|increases|larger|bigger|higher|more)[^.!?]*/i,
          /(?:larger|bigger|more)\s+(?:sample|n\b)[^.!?]*?(?:larger|bigger|higher|more)\s+(?:standard error|se\b)[^.!?]*/i,
        ]);
        if (wrong) return { verdict: "fail", quote: wrong, misconceptionId: "more_data_more_error", feedback: "A larger n reduces standard error; use the square-root change in n." };
        return { verdict: "uncertain", quote: null, misconceptionId: null, feedback: "State the factor change in standard error and connect it explicitly to the square root of the four-times-larger sample." };
      },
    review: (a) => {
        const pass = /(?:\bstudy\s*b\b|\b256\b)/i.test(a) &&
          /(half|one[- ]?half|1\s*\/\s*2|halve|two times smaller|factor of 2)/i.test(a) &&
          /(square root|sqrt|√)/i.test(a);
        if (pass) return { verdict: "pass", quote: null, misconceptionId: null, feedback: null };
        const wrong = firstMatch(a, [
          /(?:study\s*)?a[^.!?]*?(?:smaller|lower)\s+(?:standard error|se\b)[^.!?]*/i,
          /(?:standard error|se)\s+(?:(?:is|gets|becomes|will be)\s+)?(?:double|doubles|twice|larger|bigger|higher|more)[^.!?]*/i,
        ]);
        if (wrong) return { verdict: "fail", quote: wrong, misconceptionId: "more_data_more_error", feedback: "A larger sample reduces standard error; compare the square roots of 64 and 256." };
        return { verdict: "uncertain", quote: null, misconceptionId: null, feedback: "Name the study, state the factor change, and connect it to the square-root-of-n rule." };
      },
  },
};
