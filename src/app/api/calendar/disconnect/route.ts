import { withUserRoute } from "@proveit/server/userBoundary";
import { z } from "zod";
import { disconnectCalendar } from "@proveit/server/calendar";
import { handle } from "@proveit/server/route";

const POSTForUser = (req: Request) => handle(req, z.object({}), () => { disconnectCalendar(); return { ok: true as const }; });

export const POST = withUserRoute(POSTForUser);
