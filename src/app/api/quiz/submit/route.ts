import { withUserRoute } from "@proveit/server/userBoundary";
import { QuizSubmitInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { submitAssessmentQuiz } from "@proveit/server/quiz";

export const maxDuration = 90;
const POSTForUser = (req: Request) => handle(req, QuizSubmitInput, (i) => submitAssessmentQuiz(i.quizId, i.answers));

export const POST = withUserRoute(POSTForUser);

