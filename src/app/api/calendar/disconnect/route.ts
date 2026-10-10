import { z } from "zod";
import { disconnectCalendar } from "@proveit/server/calendar";
import { handle } from "@proveit/server/route";

export const POST = (req: Request) => handle(req, z.object({}), () => { disconnectCalendar(); return { ok: true as const }; });
