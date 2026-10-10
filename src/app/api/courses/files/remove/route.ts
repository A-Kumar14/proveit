import { withUserRoute } from "@proveit/server/userBoundary";
import { FileRemoveInput } from "@proveit/lib/schemas";
import { removeMaterial } from "@proveit/server/materials";
import { handle } from "@proveit/server/route";

const POSTForUser = (req: Request) => handle(req, FileRemoveInput, (i) => ({ removed: removeMaterial(i.courseId, i.id) }));

export const POST = withUserRoute(POSTForUser);
