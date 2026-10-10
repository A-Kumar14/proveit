import { PracticeInput } from "@proveit/lib/schemas";
import { studyNotes } from "@proveit/server/practice";
import { handle } from "@proveit/server/route";

export const maxDuration = 180;
export const POST = (req: Request) => handle(req, PracticeInput, (i) => studyNotes(i.courseId));
