import { AssessInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { assess } from "@proveit/server/store";

export const POST = (req: Request) => handle(req, AssessInput, assess);
