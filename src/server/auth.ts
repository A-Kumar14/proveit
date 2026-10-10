import "server-only";

/** Accounts turn on when both Clerk keys are set. Without them the app runs open, as one local user. */
export const authEnabled = () => Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export type Profile = { id: string; name: string; email: string | null; imageUrl: string | null; joined: string | null };

export const LOCAL_USER = "local";

/** The signed-in user's id, or "local" when accounts are off. Per-user storage keys use this. */
export async function currentUserId(): Promise<string> {
  if (!authEnabled()) return LOCAL_USER;
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  return userId ?? LOCAL_USER;
}

/** Name, email and avatar for the account page and the sidebar, or null when signed out or accounts are off. */
export async function currentProfile(): Promise<Profile | null> {
  if (!authEnabled()) return null;
  const { currentUser } = await import("@clerk/nextjs/server");
  const u = await currentUser();
  if (!u) return null;
  const email = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? null;
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || email || "Your account";
  return { id: u.id, name, email, imageUrl: u.imageUrl || null, joined: u.createdAt ? new Date(u.createdAt).toISOString() : null };
}
