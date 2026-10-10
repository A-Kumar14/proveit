import { withUserRoute } from "@proveit/server/userBoundary";
import { QuizSubmitInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { submitQuiz } from "@proveit/server/quiz";

const POSTForUser = (req: Request) => handle(req, QuizSubmitInput, (i) => submitQuiz(i.quizId, i.answers));

export const POST = withUserRoute(POSTForUser);
