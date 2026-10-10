import { withUserRoute } from "@proveit/server/userBoundary";
import { CourseCompleteInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { setCoursesCompleted } from "@proveit/server/store";

const POSTForUser = (req: Request) => handle(req, CourseCompleteInput, (i) => ({ updated: setCoursesCompleted(i.ids, i.completed) }));

export const POST = withUserRoute(POSTForUser);
