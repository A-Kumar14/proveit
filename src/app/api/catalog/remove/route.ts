import { CatalogAddInput } from "@proveit/lib/schemas";
import { removeCatalogCourse } from "@proveit/server/courses";
import { handle } from "@proveit/server/route";

export const POST = (req: Request) => handle(req, CatalogAddInput, (i) => removeCatalogCourse(i.id));
