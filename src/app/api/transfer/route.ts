import { TransferInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { submitTransfer } from "@proveit/server/store";

export const POST = (req: Request) => handle(req, TransferInput, (i) => submitTransfer(i.attemptId, i.answer));
