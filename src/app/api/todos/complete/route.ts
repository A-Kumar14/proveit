import { TaskDoneInput } from "@proveit/lib/schemas";
import { handle } from "@proveit/server/route";
import { setTaskDone } from "@proveit/server/store";

export const POST = (req: Request) => handle(req, TaskDoneInput, (i) => { setTaskDone(i.id, i.done); return { ok: true as const }; });
