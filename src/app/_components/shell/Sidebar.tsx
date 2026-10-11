import Link from "next/link";
import { BarChart3, BookOpen, CalendarDays, CircleCheck, ChevronRight, Flame, Hand, History, LayoutDashboard, Plus, RotateCcw, Settings, UserRound } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import type { SidebarView } from "@proveit/server/store";
import type { Profile } from "@proveit/server/auth";

export type NavKey = "dashboard" | "courses" | "review" | "history" | "calendar" | "signbridge" | "map" | "tutor" | "practice" | "misconceptions" | "files" | "settings" | "account";

const item = (on: boolean) =>
  cn("flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-sm no-underline", on ? "bg-surface-active font-semibold text-ink" : "text-ink-muted hover:bg-surface-hover");

const dotFor = (pct: number) => (pct >= 40 ? "bg-mastered" : pct > 0 ? "bg-developing" : "bg-surface-strong");
const icon = { size: 16, strokeWidth: 1.8, "aria-hidden": true } as const;

function NavLink({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return <Link href={href} aria-current={on ? "page" : undefined} className={item(on)}>{children}</Link>;
}

export function Sidebar({ data, active, courseId, profile = null }: { data: SidebarView; active: NavKey; courseId?: string; profile?: Profile | null }) {
  const inProgress = data.courses.filter((c) => !c.completed);
  const completed = data.courses.filter((c) => c.completed);
  return (
    <nav aria-label="Sidebar" className="flex w-[232px] shrink-0 flex-col gap-3.5 overflow-y-auto glass-side border-r border-line/70 px-3.5 py-4">
      <Link href="/" className="flex items-center gap-2.5 px-1 pb-0.5 text-ink no-underline">
        <span className="flex size-7 items-center justify-center rounded-md bg-ink">
          <BarChart3 size={16} strokeWidth={2.2} className="text-white" aria-hidden />
        </span>
        <span className="text-base font-semibold tracking-tight">ProveIt</span>
      </Link>

      <div className="flex flex-col gap-0.5">
        <NavLink href="/" on={active === "dashboard"}><LayoutDashboard {...icon} />Dashboard</NavLink>
        <NavLink href="/courses" on={active === "courses"}><BookOpen {...icon} />Courses</NavLink>
        <NavLink href="/review" on={active === "review"}>
          <RotateCcw {...icon} /><span className="flex-1">Review queue</span>
          {data.reviewsDue > 0 && <span className="rounded-full bg-developing-bg px-[7px] py-px text-[0.6875rem] font-semibold text-developing">{data.reviewsDue}</span>}
        </NavLink>
        <NavLink href="/history" on={active === "history"}><History {...icon} />History</NavLink>
        <NavLink href="/calendar" on={active === "calendar"}><CalendarDays {...icon} />Calendar</NavLink>
        <NavLink href="/signbridge" on={active === "signbridge"}><Hand {...icon} />ASL Assistant</NavLink>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between px-2.5 pb-1">
          <div className="eyebrow text-ink-faint">In progress</div>
          <Link href="/?add=1" aria-label="New course" className="flex items-center gap-1 text-xs font-medium text-ink-muted no-underline hover:text-ink"><Plus size={12} strokeWidth={2} aria-hidden />New</Link>
        </div>
        {inProgress.map((c) => (
          <NavLink key={c.id} href={`/course/${c.id}`} on={c.id === courseId}>
            <span className={cn("size-2 rounded-full", dotFor(c.pct))} aria-hidden />
            <span className="flex-1">{c.name}</span>
            <span className="text-[0.6875rem] font-normal text-ink-faint">{c.pct}%</span>
          </NavLink>
        ))}
        {inProgress.length === 0 && <div className="px-2.5 py-1 text-xs text-ink-faint">Nothing in progress.</div>}
      </div>

      {completed.length > 0 && (
        <details className="group flex flex-col gap-0.5" open={completed.some((c) => c.id === courseId)}>
          <summary className="eyebrow flex cursor-pointer list-none items-center gap-1 px-2.5 pb-1 text-ink-faint [&::-webkit-details-marker]:hidden">
            <ChevronRight size={12} strokeWidth={2} className="transition-transform group-open:rotate-90" aria-hidden />Completed ({completed.length})
          </summary>
          {completed.map((c) => (
            <NavLink key={c.id} href={`/course/${c.id}`} on={c.id === courseId}>
              <CircleCheck size={14} strokeWidth={2} className="text-mastered" aria-hidden />
              <span className="flex-1">{c.name}</span>
            </NavLink>
          ))}
        </details>
      )}

      <div className="mt-auto flex flex-col gap-2.5">
        {active === "dashboard" && data.streak > 0 && (
          <div className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5">
            <Flame size={20} strokeWidth={1.8} className="text-developing" aria-hidden />
            <div>
              <div className="text-[0.8125rem] font-semibold">{data.streak}-day streak</div>
              <div className="text-[0.6875rem] text-ink-faint">Prove one concept today</div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-0.5 border-t border-line pt-2">
          <NavLink href="/account" on={active === "account"}>
            {profile?.imageUrl
              // eslint-disable-next-line @next/next/no-img-element -- small avatar from Clerk's CDN
              ? <img src={profile.imageUrl} alt="" width={20} height={20} className="size-5 rounded-full object-cover" />
              : <UserRound {...icon} />}
            <span className="min-w-0 flex-1 truncate">{profile ? profile.name : "Account"}</span>
          </NavLink>
          <NavLink href="/settings" on={active === "settings"}><Settings {...icon} />Settings</NavLink>
        </div>
      </div>
    </nav>
  );
}
