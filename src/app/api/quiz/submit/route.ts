import { QuizSubmitInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { submitQuiz } from "@proveit/server/quiz";

export const POST = (req: Request) => handle(req, QuizSubmitInput, (i) => submitQuiz(i.quizId, i.answers));
