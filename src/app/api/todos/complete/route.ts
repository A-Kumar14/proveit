import { withUserRoute } from "@proveit/server/userBoundary";
import { TaskDoneInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { setTaskDone } from "@proveit/server/store";

const POSTForUser = (req: Request) => handle(req, TaskDoneInput, (i) => { setTaskDone(i.id, i.done); return { ok: true as const }; });

export const POST = withUserRoute(POSTForUser);
