import { ReviewSubmitInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { submitReview } from "@proveit/server/store";

export const maxDuration = 60;
export const POST = (req: Request) => handle(req, ReviewSubmitInput, (i) => submitReview(i.courseId, i.conceptId, i.answer));
