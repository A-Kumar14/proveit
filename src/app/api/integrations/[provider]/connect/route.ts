import { NextResponse } from "next/server";
import { ConnectInput } from "@proveit/lib/schemas";
import { currentUserId } from "@proveit/server/auth";
import { beginConnect, isProvider, originOf, PROVIDERS } from "@proveit/server/integrations";
import { UpstreamError } from "@proveit/server/modelError";
import { handle } from "@proveit/server/route";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/integrations/[provider]/connect">) {
  const { provider } = await ctx.params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const user = await currentUserId();
  // The provider in the path is the one that counts, so the body's can't point at another.
  return handle(req, ConnectInput.omit({ provider: true }), async (i) => {
    try {
      return await beginConnect(user, provider, originOf(req), i.returnTo ?? "/account");
    } catch (e) {
      console.error(e);
      throw new UpstreamError(`Couldn't reach ${PROVIDERS[provider].name}. Retry in a moment.`);
    }
  });
}
