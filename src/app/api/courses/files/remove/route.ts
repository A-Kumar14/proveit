import { FileRemoveInput } from "@proveit/lib/schemas";
import { removeMaterial } from "@proveit/server/materials";
import { handle } from "@proveit/server/route";

export const POST = (req: Request) => handle(req, FileRemoveInput, (i) => ({ removed: removeMaterial(i.courseId, i.id) }));
