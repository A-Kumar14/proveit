import { withUserRoute } from "@proveit/server/userBoundary";
import { ProviderInput } from "@proveit/lib/schemas";
import { currentUserId } from "@proveit/server/auth";
import { disconnect } from "@proveit/server/integrations";
import { handle } from "@proveit/server/route";

const POSTForUser = (req: Request) => handle(req, ProviderInput, async (i) => { disconnect(await currentUserId(), i.provider); return { ok: true as const }; });

export const POST = withUserRoute(POSTForUser);
