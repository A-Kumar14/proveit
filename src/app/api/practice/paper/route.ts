import { PracticeInput } from "@proveit/lib/schemas";
import { samplePaper } from "@proveit/server/practice";
import { handle } from "@proveit/server/route";

export const maxDuration = 180;
export const POST = (req: Request) => handle(req, PracticeInput, (i) => samplePaper(i.courseId));
