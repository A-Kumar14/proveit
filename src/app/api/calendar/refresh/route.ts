import { z } from "zod";
import { refreshCalendar } from "@proveit/server/calendar";
import { handle } from "@proveit/server/route";

export const maxDuration = 30;
export const POST = (req: Request) => handle(req, z.object({}), async () => { await refreshCalendar(); return { ok: true as const }; });
