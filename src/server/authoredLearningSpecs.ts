import "server-only";
import { ConceptLearningSpec } from "@proveit/lib/conceptLearningSpec";

// Canonical content for the two authored concepts. Reference labels preserve existing metadata;
// they are not retrieved excerpts or independently verified citations.
const specs: ConceptLearningSpec[] = [
  {
    "schemaVersion": 1,
    "courseId": "intro-stats",
    "conceptId": "cii",
    "revision": 1,
    "provenance": {
      "kind": "authored"
    },
    "sources": [
      {
        "id": "authored-cii",
        "kind": "authored_reference",
        "title": "OpenStax Introductory Statistics 2e",
        "locator": "ProveIt Unit 03: Confidence intervals"
      }
    ],
    "assessment": {
      "question": "Explain what a 95% confidence interval means.",
      "correctAnswer": "A 95% confidence level describes the method. Over many repeated samples about 95% of the intervals built this way contain the true mean. Once one interval is calculated, the mean is fixed, so that interval either contains it or does not.",
      "rubric": "Explains that 95% is the long-run coverage of the interval-building method across repeated samples, not a probability assigned to the fixed mean after one interval is calculated.",
      "probe": "No problem. Start smaller. If you built one 95% interval from your sample, what does the 95% describe, the method or this one interval? Guess in one sentence.",
      "sourceIds": [
        "authored-cii"
      ]
    },
    "misconceptions": [
      {
        "id": "parameter_probability_trap",
        "name": "Parameter probability trap",
        "description": "You're treating the population mean as random after the interval is already calculated. It's fixed; your interval either contains it or doesn't.",
        "clarificationQuestion": "When you said 95% probability, did you mean the long-run method captures the mean about 95% of the time, or that this one already-calculated interval still has a 95% chance? Say which one you meant and why.",
        "sourceIds": [
          "authored-cii"
        ]
      }
    ],
    "remediations": [
      {
        "misconceptionId": "parameter_probability_trap",
        "title": "The 95% describes the method, not your one interval.",
        "actuallyTrue": "Repeat the study many times and about 95% of the intervals would catch the mean.",
        "explanation": "Once your interval is calculated, the mean isn't moving. It's either inside or not. You just can't tell which.",
        "sourceLabel": "Rule from course material, Unit 03",
        "figure": "ci-intervals",
        "sourceIds": [
          "authored-cii"
        ]
      }
    ],
    "transfer": {
      "question": "100 researchers each take their own sample and build a 95% confidence interval the same way. About how many intervals should contain the true mean? What does that tell you about one interval after it's calculated?",
      "hint": "Think about the 10 bars in the lesson, then scale up to 100.",
      "rubric": "Passes only if the student says about 95 of 100 intervals contain the true mean AND that any one already-calculated interval either contains it or does not (no 95% probability for that single interval; the 95% describes the method).",
      "correctAnswer": "About 95 of the 100 intervals should contain the true mean. One already-calculated interval either contains the fixed mean or does not; 95% describes the method.",
      "sourceIds": [
        "authored-cii"
      ]
    },
    "review": {
      "question": "A report says: “A 95% confidence interval from 12.4 to 16.8 means there is a 95% chance the true mean lies in that range.” Is that interpretation valid? Explain what the 95% actually refers to.",
      "hint": "Separate what is random across repeated samples from what is fixed after one interval is calculated.",
      "rubric": "Passes only if the student rejects the 95% probability claim for the realized interval AND explains that 95% is the long-run coverage of the interval-building method over repeated samples.",
      "correctAnswer": "The report is incorrect. The 95% describes long-run coverage of the interval-building method over repeated samples. This realized interval either contains the fixed mean or does not.",
      "sourceIds": [
        "authored-cii"
      ]
    },
    "skills": {
      "onWrong": {
        "label": "Interpretation",
        "pct": 30
      },
      "onRight": {
        "label": "Interpretation",
        "pct": 85
      }
    }
  },
  {
    "schemaVersion": 1,
    "courseId": "intro-stats",
    "conceptId": "se",
    "revision": 1,
    "provenance": {
      "kind": "authored"
    },
    "sources": [
      {
        "id": "authored-se",
        "kind": "authored_reference",
        "title": "OpenStax Introductory Statistics 2e",
        "locator": "ProveIt Unit 02: Distributions"
      }
    ],
    "assessment": {
      "question": "Researcher A samples 25 students and Researcher B samples 400 from the same school. Whose sample mean has the smaller standard error, and why?",
      "correctAnswer": "Standard error equals the spread divided by the square root of n, so a larger sample gives a smaller standard error.",
      "rubric": "Identifies Researcher B (n = 400) as having the smaller standard error and explains that standard error decreases as sample size grows through the square-root-of-n relationship.",
      "probe": "No problem. Pick one. With more students in the sample, does the sample mean bounce around more or less from sample to sample?",
      "sourceIds": [
        "authored-se"
      ]
    },
    "misconceptions": [
      {
        "id": "more_data_more_error",
        "name": "More data means more error",
        "description": "You're treating a bigger sample as a bigger source of error. Standard error shrinks as the sample grows, at a square-root rate.",
        "clarificationQuestion": "When you connected a larger sample to more error, did you mean more raw data can vary, or that the standard error of the sample mean itself gets larger? Explain what happens to standard error as n grows.",
        "sourceIds": [
          "authored-se"
        ]
      }
    ],
    "remediations": [
      {
        "misconceptionId": "more_data_more_error",
        "title": "A bigger sample shrinks the standard error.",
        "actuallyTrue": "Standard error is the spread divided by the square root of n, so more data means less sampling noise.",
        "explanation": "400 is 16 times 25, so the standard error is 4 times smaller for Researcher B.",
        "sourceLabel": "Rule from course material, Unit 02",
        "figure": null,
        "sourceIds": [
          "authored-se"
        ]
      }
    ],
    "transfer": {
      "question": "A pollster goes from 100 respondents to 400. By what factor does the standard error change, and why?",
      "hint": "The sample is 4 times bigger. What do you do to 4 to get the factor?",
      "rubric": "Passes only if the student says the standard error is cut in half (factor of 1/2) AND explains it with the square root of the sample size (sqrt(4) = 2).",
      "correctAnswer": "Standard error is cut in half: sample size increases by a factor of 4, so the square root factor is 2 and SE is divided by 2.",
      "sourceIds": [
        "authored-se"
      ]
    },
    "review": {
      "question": "Two studies estimate the same population mean with the same population spread. Study A has n = 64 and Study B has n = 256. Which study has the smaller standard error, and by what factor? Explain why.",
      "hint": "Compare the sample sizes first, then apply the square root in the standard-error formula.",
      "rubric": "Passes only if the student identifies Study B (n=256) as having the smaller standard error, says it is one-half of Study A's, and explains that 256/64=4 so the square-root factor is 2.",
      "correctAnswer": "Study B (n = 256) has half the standard error of Study A. The sample size is four times larger, so the square root factor is 2.",
      "sourceIds": [
        "authored-se"
      ]
    },
    "skills": {
      "onWrong": {
        "label": "Application",
        "pct": 25
      },
      "onRight": {
        "label": "Application",
        "pct": 85
      }
    }
  }
] .map((spec) => ConceptLearningSpec.parse(spec));

/** Return copies so callers cannot mutate shared canonical content. */
export function listAuthoredLearningSpecs(): ConceptLearningSpec[] {
  return specs.map((spec) => ConceptLearningSpec.parse(spec));
}

export function getAuthoredLearningSpec(courseId: string, conceptId: string, revision?: number): ConceptLearningSpec | null {
  const spec = specs.find((s) => s.courseId === courseId && s.conceptId === conceptId && (revision === undefined || s.revision === revision));
  return spec ? ConceptLearningSpec.parse(spec) : null;
}
