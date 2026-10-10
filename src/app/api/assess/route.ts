import { withUserRoute } from "@proveit/server/userBoundary";
import { AssessInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { assess } from "@proveit/server/store";

export const maxDuration = 60;
const POSTForUser = (req: Request) => handle(req, AssessInput, assess);

export const POST = withUserRoute(POSTForUser);
