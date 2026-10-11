import { withUserRoute } from "@proveit/server/userBoundary";
import { ReviewSubmitInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { submitReview } from "@proveit/server/store";

export const maxDuration = 60;
const POSTForUser = (req: Request) => handle(req, ReviewSubmitInput, (i) => submitReview(i.courseId, i.conceptId, i.answer, new Date(), i.learningSpecRevision));

export const POST = withUserRoute(POSTForUser);
