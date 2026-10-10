import { withUserRoute } from "@proveit/server/userBoundary";
import { ClarifyInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { clarify } from "@proveit/server/store";

const POSTForUser = (req: Request) => handle(req, ClarifyInput, (i) => clarify(i.attemptId));

export const POST = withUserRoute(POSTForUser);
