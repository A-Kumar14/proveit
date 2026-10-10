import { withUserRoute } from "@proveit/server/userBoundary";
import { CalendarConnectInput } from "@proveit/lib/schemas";
import { connectCalendar } from "@proveit/server/calendar";
import { handle } from "@proveit/server/route";

export const maxDuration = 30;
const POSTForUser = (req: Request) => handle(req, CalendarConnectInput, async (i) => { await connectCalendar(i.url); return { ok: true as const }; });

export const POST = withUserRoute(POSTForUser);
