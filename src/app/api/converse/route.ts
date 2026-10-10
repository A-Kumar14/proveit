import { withUserRoute } from "@proveit/server/userBoundary";
import { ConverseInput } from "@proveit/lib/schemas";
import { nextTurn } from "@proveit/server/converse";
import { handle } from "@proveit/server/route";

export const maxDuration = 60;
const POSTForUser = (req: Request) => handle(req, ConverseInput, nextTurn);

export const POST = withUserRoute(POSTForUser);
