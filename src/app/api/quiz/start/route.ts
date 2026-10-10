import { withUserRoute } from "@proveit/server/userBoundary";
import { QuizStartInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { startQuiz } from "@proveit/server/quiz";

export const maxDuration = 90;
const POSTForUser = (req: Request) => handle(req, QuizStartInput, (i) => startQuiz(i.courseId, i.count, i.conceptId));

export const POST = withUserRoute(POSTForUser);
