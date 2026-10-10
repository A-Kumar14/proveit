import { z } from "zod";
import { resetDemoCalendar } from "@proveit/server/calendar";
import { handle } from "@proveit/server/route";
import { resetDemoLearning } from "@proveit/server/store";

export const POST = (req: Request) => handle(req, z.object({}), () => {
  resetDemoLearning();
  resetDemoCalendar();
  return { ok: true as const };
});
