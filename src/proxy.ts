import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Accounts are on only when both Clerk keys exist. Without them every route stays open, so local work needs no setup.
const enabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
const isPublic = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default enabled
  ? clerkMiddleware(async (auth, req) => { if (!isPublic(req)) await auth.protect(); })
  : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next.js internals and static files unless they appear in the search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
