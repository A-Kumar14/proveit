import { withUserRoute } from "@proveit/server/userBoundary";
import { CatalogAddInput } from "@proveit/lib/schemas";
import { removeCatalogCourse } from "@proveit/server/courses";
import { handle } from "@proveit/server/route";

const POSTForUser = (req: Request) => handle(req, CatalogAddInput, (i) => removeCatalogCourse(i.id));

export const POST = withUserRoute(POSTForUser);
