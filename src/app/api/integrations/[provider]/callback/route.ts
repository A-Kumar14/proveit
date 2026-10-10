import { withUserRoute } from "@proveit/server/userBoundary";
import { NextResponse } from "next/server";
import { currentUserId } from "@proveit/server/auth";
import { completeConnect, isProvider, originOf, safeReturn } from "@proveit/server/integrations";
import { MaterialError } from "@proveit/server/materials";

export const maxDuration = 60;

/** Where the provider sends the browser after the student approves. It trades the code for access, then goes back. */
async function GETForUser(req: Request, ctx: RouteContext<"/api/integrations/[provider]/callback">) {
  const { provider } = await ctx.params;
  const origin = originOf(req);
  if (!isProvider(provider)) return NextResponse.redirect(new URL("/account", origin));
  const url = new URL(req.url);
  const back = (path: string, params: Record<string, string>) => {
    const to = new URL(safeReturn(path), origin);
    for (const [k, v] of Object.entries(params)) to.searchParams.set(k, v);
    return NextResponse.redirect(to);
  };
  const denied = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (denied || !code) return back("/account", { integration_error: denied === "access_denied" ? "You cancelled the connection." : "The connection didn't finish. Try again." });
  try {
    const { returnTo } = await completeConnect(await currentUserId(), provider, origin, code, url.searchParams.get("state"));
    return back(returnTo, { connected: provider });
  } catch (e) {
    if (!(e instanceof MaterialError)) console.error(e);
    return back("/account", { integration_error: e instanceof MaterialError ? e.message : "The connection didn't finish. Try again." });
  }
}

export const GET = withUserRoute(GETForUser);
