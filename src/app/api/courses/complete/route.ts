import { CourseCompleteInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { setCoursesCompleted } from "@proveit/server/store";

export const POST = (req: Request) => handle(req, CourseCompleteInput, (i) => ({ updated: setCoursesCompleted(i.ids, i.completed) }));
