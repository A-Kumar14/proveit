/** Hand-authored content for the concepts that run end to end (pitch doc, phase 1). */
export type Authored = {
  question: string;
  misconception: { id: string; name: string; gap: string };
  /** Demo heuristic. The Gemini evaluator replaces this behind the same return shape. */
  judge: (answer: string) => { verdict: "correct" | "incorrect" | "uncertain"; quote: string | null };
  lesson: {
    title: string;
    actuallyTrue: string;
    explanation: string;
    rule: string | null;
    figure: "ci-intervals" | null;
  };
  transfer: { question: string; hint: string; judge: (answer: string) => boolean };
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

export const AUTHORED: Record<string, Authored> = {
  cii: {
    question: "Explain what a 95% confidence interval means.",
    misconception: {
      id: "parameter_probability_trap",
      name: "Parameter probability trap",
      gap: "You're treating the population mean as random after the interval is already calculated. It's fixed; your interval either contains it or doesn't.",
    },
    judge: (answer) => {
      if (words(answer) < 6) return { verdict: "uncertain", quote: null };
      const quote = firstMatch(answer, ciWrong);
      if (quote) return { verdict: "incorrect", quote };
      const ok = /95/.test(answer) && /(method|procedure|process|repeat|many (samples|studies)|long run|intervals)/i.test(answer);
      return { verdict: ok ? "correct" : "uncertain", quote: null };
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
      judge: (a) =>
        /\b95\b/.test(a) &&
        /(either (contains|contain|does|is)|already (been )?(calculated|computed|built)|no (95\s*%|probability|chance)|not (a )?95\s*%|describes? the (method|procedure)|the method|long.?run)/i.test(a),
    },
    skillOnWrong: { label: "Interpretation", pct: 30 },
    skillOnRight: { label: "Interpretation", pct: 85 },
  },
  se: {
    question: "Researcher A samples 25 students and Researcher B samples 400 from the same school. Whose sample mean has the smaller standard error, and why?",
    misconception: {
      id: "more_data_more_error",
      name: "More data means more error",
      gap: "You're treating a bigger sample as a bigger source of error. Standard error shrinks as the sample grows, at a square-root rate.",
    },
    judge: (answer) => {
      if (words(answer) < 6) return { verdict: "uncertain", quote: null };
      const quote = firstMatch(answer, [
        /(?:larger|bigger|higher|more)\s+(?:sample|n\b)[^.!?]*?(?:larger|bigger|higher|more)\s+(?:standard error|se\b|error)[^.!?]*/i,
        /(?:standard error|se)\s+(?:is|gets|grows|increases)[^.!?]*?(?:larger|bigger|higher|more)[^.!?]*/i,
      ]);
      if (quote) return { verdict: "incorrect", quote };
      const ok = /(smaller|lower|less|shrink|decrease)/i.test(answer) && /(400|larger|bigger|more)/i.test(answer);
      return { verdict: ok ? "correct" : "uncertain", quote: null };
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
      judge: (a) => /(half|1\s*\/\s*2|halve|divided by 2|factor of 2|2\s*x|two times)/i.test(a) && /(square root|sqrt|√)/i.test(a),
    },
    skillOnWrong: { label: "Application", pct: 25 },
    skillOnRight: { label: "Application", pct: 85 },
  },
};
