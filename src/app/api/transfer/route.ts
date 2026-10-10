import { withUserRoute } from "@proveit/server/userBoundary";
import { TransferInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { submitTransfer } from "@proveit/server/store";

export const maxDuration = 60;
const POSTForUser = (req: Request) => handle(req, TransferInput, (i) => submitTransfer(i.attemptId, i.answer));

export const POST = withUserRoute(POSTForUser);
