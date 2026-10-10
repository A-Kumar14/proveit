/** Hand-authored content for the concepts that run end to end (pitch doc, phase 1). */
export type Misconception = { id: string; name: string; gap: string; clarify: string };

export type TransferSeed = {
  verdict: "pass" | "fail" | "uncertain";
  quote: string | null;
  misconceptionId: string | null;
  feedback: string | null;
};

export type Authored = {
  /** Course-material truth the evaluator grades against. */
  correct: string;
  /** Diagnostic probe asked when the student says "I don't know yet". Smaller than the main question. */
  probe: string;
  question: string;
  /** A concept can have several distinct misconceptions; evaluators must name one instead of guessing. */
  misconceptions: Misconception[];
  /** Demo heuristic. The Gemini evaluator replaces this behind the same return shape. */
  judge: (answer: string) => { verdict: "correct" | "incorrect" | "uncertain"; quote: string | null; misconceptionId: string | null };
  lesson: {
    title: string;
    actuallyTrue: string;
    explanation: string;
    rule: string | null;
    figure: "ci-intervals" | null;
  };
  transfer: { question: string; hint: string; rubric: string; judge: (answer: string) => TransferSeed };
  /** Delayed retrieval uses a fresh surface form instead of replaying the transfer question. */
  review: { question: string; hint: string; rubric: string; judge: (answer: string) => TransferSeed };
  skillOnWrong: { label: string; pct: number };
  skillOnRight: { label: string; pct: number };
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

export const AUTHORED: Record<string, Authored> = {
  cii: {
    correct: "A 95% confidence level describes the method. Over many repeated samples about 95% of the intervals built this way contain the true mean. Once one interval is calculated, the mean is fixed, so that interval either contains it or does not.",
    probe: "No problem. Start smaller. If you built one 95% interval from your sample, what does the 95% describe, the method or this one interval? Guess in one sentence.",
    question: "Explain what a 95% confidence interval means.",
    misconceptions: [{
      id: "parameter_probability_trap",
      name: "Parameter probability trap",
      gap: "You're treating the population mean as random after the interval is already calculated. It's fixed; your interval either contains it or doesn't.",
      clarify: "When you said 95% probability, did you mean the long-run method captures the mean about 95% of the time, or that this one already-calculated interval still has a 95% chance? Say which one you meant and why.",
    }],
    judge: (answer) => {
      if (words(answer) < 6) return { verdict: "uncertain", quote: null, misconceptionId: null };
      const quote = firstMatch(answer, ciWrong);
      if (quote && !rejectsCiProbability(answer)) return { verdict: "incorrect", quote, misconceptionId: "parameter_probability_trap" };
      const explainsMethod = /(method|procedure|process|repeat|many (samples|studies)|long run|intervals)/i.test(answer);
      const explicitCorrection = /(method|procedure|long run|repeat)/i.test(answer) && /(not|rather than|instead of)[^.!?]*(one|single|this)[^.!?]*interval/i.test(answer);
      const ok = (/95/.test(answer) && explainsMethod) || explicitCorrection;
      return { verdict: ok ? "correct" : "uncertain", quote: null, misconceptionId: null };
    },
    lesson: {
      title: "The 95% describes the method, not your one interval.",
      actuallyTrue: "Repeat the study many times and about 95% of the intervals would catch the mean.",
      explanation: "Once your interval is calculated, the mean isn't moving. It's either inside or not. You just can't tell which.",
      rule: "Rule from course material, Unit 03",
      figure: "ci-intervals",
    },
    transfer: {
      question:
        "100 researchers each take their own sample and build a 95% confidence interval the same way. About how many intervals should contain the true mean? What does that tell you about one interval after it's calculated?",
      hint: "Think about the 10 bars in the lesson, then scale up to 100.",
      rubric: "Passes only if the student says about 95 of 100 intervals contain the true mean AND that any one already-calculated interval either contains it or does not (no 95% probability for that single interval; the 95% describes the method).",
      judge: (a) => {
        // Check the complete rubric first so a correct phrase such as "no 95% chance" is not
        // mistaken for the misconception merely because it contains the words "95% chance".
        const quote = firstMatch(a, ciWrong);
        if (quote && !rejectsCiProbability(a)) return { verdict: "fail", quote, misconceptionId: "parameter_probability_trap", feedback: "For one already-calculated interval, don't assign a 95% probability to the fixed mean." };
        const pass = /\b95\b/.test(a) &&
          /(either (contains|contain|does|is)|already (been )?(calculated|computed|built)|no (95\s*%|probability|chance)|not (a )?95\s*%|describes? the (method|procedure)|the method|long.?run)/i.test(a);
        if (pass) return { verdict: "pass", quote: null, misconceptionId: null, feedback: null };
        return { verdict: "uncertain", quote: null, misconceptionId: null, feedback: "Answer both parts: the long-run count out of 100, and what the 95% means for one interval after it is calculated." };
      },
    },
    review: {
      question: "A report says: “A 95% confidence interval from 12.4 to 16.8 means there is a 95% chance the true mean lies in that range.” Is that interpretation valid? Explain what the 95% actually refers to.",
      hint: "Separate what is random across repeated samples from what is fixed after one interval is calculated.",
      rubric: "Passes only if the student rejects the 95% probability claim for the realized interval AND explains that 95% is the long-run coverage of the interval-building method over repeated samples.",
      judge: (a) => {
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
    skillOnWrong: { label: "Interpretation", pct: 30 },
    skillOnRight: { label: "Interpretation", pct: 85 },
  },
  se: {
    correct: "Standard error equals the spread divided by the square root of n, so a larger sample gives a smaller standard error.",
    probe: "No problem. Pick one. With more students in the sample, does the sample mean bounce around more or less from sample to sample?",
    question: "Researcher A samples 25 students and Researcher B samples 400 from the same school. Whose sample mean has the smaller standard error, and why?",
    misconceptions: [{
      id: "more_data_more_error",
      name: "More data means more error",
      gap: "You're treating a bigger sample as a bigger source of error. Standard error shrinks as the sample grows, at a square-root rate.",
      clarify: "When you connected a larger sample to more error, did you mean more raw data can vary, or that the standard error of the sample mean itself gets larger? Explain what happens to standard error as n grows.",
    }],
    judge: (answer) => {
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
    lesson: {
      title: "A bigger sample shrinks the standard error.",
      actuallyTrue: "Standard error is the spread divided by the square root of n, so more data means less sampling noise.",
      explanation: "400 is 16 times 25, so the standard error is 4 times smaller for Researcher B.",
      rule: "Rule from course material, Unit 02",
      figure: null,
    },
    transfer: {
      question: "A pollster goes from 100 respondents to 400. By what factor does the standard error change, and why?",
      hint: "The sample is 4 times bigger. What do you do to 4 to get the factor?",
      rubric: "Passes only if the student says the standard error is cut in half (factor of 1/2) AND explains it with the square root of the sample size (sqrt(4) = 2).",
      judge: (a) => {
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
    },
    review: {
      question: "Two studies estimate the same population mean with the same population spread. Study A has n = 64 and Study B has n = 256. Which study has the smaller standard error, and by what factor? Explain why.",
      hint: "Compare the sample sizes first, then apply the square root in the standard-error formula.",
      rubric: "Passes only if the student identifies Study B (n=256) as having the smaller standard error, says it is one-half of Study A's, and explains that 256/64=4 so the square-root factor is 2.",
      judge: (a) => {
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
    skillOnWrong: { label: "Application", pct: 25 },
    skillOnRight: { label: "Application", pct: 85 },
  },
};
