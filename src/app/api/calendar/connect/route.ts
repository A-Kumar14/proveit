import { CalendarConnectInput } from "@proveit/lib/schemas";
import { connectCalendar } from "@proveit/server/calendar";
import { handle } from "@proveit/server/route";

export const maxDuration = 30;
export const POST = (req: Request) => handle(req, CalendarConnectInput, async (i) => { await connectCalendar(i.url); return { ok: true as const }; });
