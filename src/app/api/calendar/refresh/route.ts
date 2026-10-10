import { withUserRoute } from "@proveit/server/userBoundary";
import { z } from "zod";
import { refreshCalendar } from "@proveit/server/calendar";
import { handle } from "@proveit/server/route";

export const maxDuration = 30;
const POSTForUser = (req: Request) => handle(req, z.object({}), async () => { await refreshCalendar(); return { ok: true as const }; });

export const POST = withUserRoute(POSTForUser);
