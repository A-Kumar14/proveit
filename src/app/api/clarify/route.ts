import { ClarifyInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { clarify } from "@proveit/server/store";

export const POST = (req: Request) => handle(req, ClarifyInput, (i) => clarify(i.attemptId));
