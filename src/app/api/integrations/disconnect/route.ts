import { ProviderInput } from "@proveit/lib/schemas";
import { currentUserId } from "@proveit/server/auth";
import { disconnect } from "@proveit/server/integrations";
import { handle } from "@proveit/server/route";

export const POST = (req: Request) => handle(req, ProviderInput, async (i) => { disconnect(await currentUserId(), i.provider); return { ok: true as const }; });
