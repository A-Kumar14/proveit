import { withUserRoute } from "@proveit/server/userBoundary";
import { ImportInput } from "@proveit/lib/schemas";
import { currentUserId } from "@proveit/server/auth";
import { importCourse, originOf } from "@proveit/server/integrations";
import { handle } from "@proveit/server/route";

export const maxDuration = 180;
const POSTForUser = (req: Request) => handle(req, ImportInput, async (i) => importCourse(await currentUserId(), i.provider, originOf(req), i.topic, i.name));

export const POST = withUserRoute(POSTForUser);
