import "server-only";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { currentUserId, UnauthorizedError } from "./auth";
import { runAsUser } from "./userScope";

/** Protect custom/streaming routes as well as routes using the shared JSON handler. */
export function withUserRoute<Args extends unknown[]>(run: (...args: Args) => Response | Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      const user = await currentUserId();
      return await runAsUser(user, () => run(...args));
    } catch (error) {
      if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
      throw error;
    }
  };
}

/** Each server component establishes its own context; React renders children separately. */
export function withUserPage<Args extends unknown[], Result>(run: (...args: Args) => Result) {
  return async (...args: Args): Promise<Awaited<Result>> => {
    let user: string;
    try { user = await currentUserId(); }
    catch (error) {
      if (error instanceof UnauthorizedError) redirect("/sign-in");
      throw error;
    }
    return await runAsUser(user, () => run(...args));
  };
}
