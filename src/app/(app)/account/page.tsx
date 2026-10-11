import { withUserPage } from "@proveit/server/userBoundary";
import Link from "next/link";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { ListPage } from "@proveit/app/_components/shell/ListPage";
import { AccountActions } from "@proveit/app/_components/account/AccountActions";
import { ConnectedApps } from "@proveit/app/_components/apps/ConnectedApps";
import { TierBadge } from "@proveit/app/_components/dashboard/TierBadge";
import { authEnabled, currentProfile, currentUserId } from "@proveit/server/auth";
import { connectionStatus } from "@proveit/server/integrations";
import { getCalendarState } from "@proveit/server/calendar";
import { getVoiceUsage, voiceCapSeconds } from "@proveit/server/prefs";
import { getAccountStats, getRewards, listCourses } from "@proveit/server/store";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("en-US");
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

async function AccountPage({ searchParams }: PageProps<"/account">) {
  const { connected, integration_error: integrationError } = await searchParams;
  const enabled = authEnabled();
  const profile = await currentProfile();
  const rank = getRewards();
  const courses = listCourses();
  const activity = getAccountStats();
  const usage = getVoiceUsage();
  const cap = voiceCapSeconds();
  const calendar = getCalendarState();
  const minutes = (sec: number) => `${Math.floor(sec / 60)} min`;
  const stats: [string, string][] = [
    ["Courses", `${courses.filter((c) => !c.completed).length} in progress, ${courses.filter((c) => c.completed).length} completed`],
    ["Concepts mastered", fmt(courses.reduce((n, c) => n + c.proven, 0))],
    ["Overall rank", `${rank.tier.name}, ${fmt(rank.points)} points${rank.next ? `, ${fmt(rank.toNext)} to ${rank.next.name}` : ""}`],
    ["Study streak", `${activity.streak} ${activity.streak === 1 ? "day" : "days"} now, ${activity.bestStreak} best`],
    ["Days with proof", fmt(activity.activeDays)],
    ["Concepts by state", `${activity.byState.mastered} mastered, ${activity.byState.provisional} proved, ${activity.byState.developing + activity.byState.needs_work} in progress, ${activity.byState.not_started} not started`],
    ["Quizzes taken", fmt(activity.quizzesTaken)],
    ["Voice calls", usage.calls === 0 ? "None yet" : `${fmt(usage.calls)} ${usage.calls === 1 ? "call" : "calls"}, ${minutes(usage.seconds)}${cap ? ` of ${minutes(cap)}` : ""}`],
  ];
  return (
    <AppShell active="account" crumbs={[{ label: "Account" }]}>
      <ListPage eyebrow="You" title="Account">
        <section aria-label="Profile" className="flex items-center gap-4 rounded-md border border-line bg-surface p-5">
          {profile?.imageUrl
            // eslint-disable-next-line @next/next/no-img-element -- avatar from Clerk's CDN, size is fixed
            ? <img src={profile.imageUrl} alt="" width={56} height={56} className="size-14 rounded-full border border-line object-cover" />
            : <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-surface-active text-lg font-semibold text-ink-3">{profile ? initials(profile.name) : "?"}</span>}
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">{profile?.name ?? "Local learner"}</div>
            <div className="truncate text-[0.8125rem] text-ink-muted">{profile?.email ?? (enabled ? "Not signed in" : "No account connected")}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.6875rem] text-ink-faint">
              {profile?.joined && <span>Member since {new Date(profile.joined).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>}
            </div>
          </div>
          <TierBadge id={rank.tier.id} size={44} />
        </section>

        {enabled ? (profile ? <AccountActions /> : (
          <div className="flex gap-2 text-[0.8125rem]"><Link href="/sign-in" className="text-ink">Sign in</Link><span className="text-ink-faint">or</span><Link href="/sign-up" className="text-ink">create an account</Link></div>
        )) : (
          <section aria-label="Accounts are off" className="flex flex-col gap-2 rounded-md border border-developing-line bg-developing-bg p-4 text-[0.8125rem] leading-normal text-ink-2">
            <div className="font-semibold text-developing-text">Accounts are turned off</div>
            <p className="m-0">Sign-in is built on Clerk. To turn it on, create an application at dashboard.clerk.com, copy its publishable and secret keys, and set <code className="rounded-xs bg-surface px-1">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code className="rounded-xs bg-surface px-1">CLERK_SECRET_KEY</code> in the server environment. Restart, and every page asks for a sign-in.</p>
            <p className="m-0 text-ink-muted">Until then the app runs as one local learner. Learning progress is stored once for the whole server, not per account, so two people signing in would see the same progress.</p>
          </section>
        )}

        <section aria-label="Your progress" className="flex flex-col overflow-hidden rounded-md border border-line bg-surface">
          {stats.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[0.8125rem] first:border-t-0"><span className="text-ink-muted">{k}</span><span className="font-semibold">{v}</span></div>
          ))}
        </section>
        <section aria-label="Calendar" className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3 text-[0.8125rem]">
          <div className="min-w-0"><div className="font-semibold">Calendar</div><div className="text-ink-muted">{calendar.mode === "ics" ? `Connected${calendar.provider ? `, ${calendar.provider}` : ""}. Review times fit around your events.` : "Not connected. Connect an iCal link and review times fit around your events."}</div></div>
          <Link href="/?connect=1" className="shrink-0 text-ink">{calendar.mode === "ics" ? "Manage" : "Connect"}</Link>
        </section>
        <section aria-label="Your data" className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3 text-[0.8125rem]">
          <div className="min-w-0"><div className="font-semibold">Your data</div><div className="text-ink-muted">Download everything, clear chats, or start a course over.</div></div>
          <Link href="/settings" className="shrink-0 text-ink">Open settings</Link>
        </section>
        <ConnectedApps apps={connectionStatus(await currentUserId())} notice={{ connected: typeof connected === "string" ? connected : undefined, error: typeof integrationError === "string" ? integrationError : undefined }} />
      </ListPage>
    </AppShell>
  );
}

export default withUserPage(AccountPage);
