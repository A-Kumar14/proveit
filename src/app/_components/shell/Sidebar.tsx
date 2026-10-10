import Link from "next/link";
import { BarChart3, CircleCheck, ChevronRight, Flame, FolderOpen, History, LayoutDashboard, MessageSquare, Mic, Plus, RotateCcw, Settings, TriangleAlert } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import type { SidebarView } from "@proveit/server/store";

export type NavKey = "dashboard" | "review" | "history" | "map" | "tutor" | "practice" | "misconceptions" | "files" | "settings";

const item = (on: boolean) =>
  cn("flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-sm no-underline", on ? "bg-surface-active font-semibold text-ink" : "text-ink-muted hover:bg-surface-hover");

const dotFor = (pct: number) => (pct >= 40 ? "bg-mastered" : pct > 0 ? "bg-developing" : "bg-surface-strong");
const icon = { size: 16, strokeWidth: 1.8, "aria-hidden": true } as const;

function NavLink({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return <Link href={href} aria-current={on ? "page" : undefined} className={item(on)}>{children}</Link>;
}

export function Sidebar({ data, active, courseId }: { data: SidebarView; active: NavKey; courseId?: string }) {
  const course = data.courses.find((c) => c.id === courseId);
  const inProgress = data.courses.filter((c) => !c.completed);
  const completed = data.courses.filter((c) => c.completed);
  const base = course ? `/course/${course.id}` : "";
  return (
    <nav aria-label="Sidebar" className="flex w-[232px] shrink-0 flex-col gap-3.5 overflow-y-auto border-r border-line bg-surface-sidebar px-3.5 py-4">
      <Link href="/" className="flex items-center gap-2.5 px-1 pb-0.5 text-ink no-underline">
        <span className="flex size-7 items-center justify-center rounded-md bg-ink">
          <BarChart3 size={16} strokeWidth={2.2} className="text-white" aria-hidden />
        </span>
        <span className="text-base font-semibold tracking-tight">Mastery</span>
      </Link>

      <div className="flex flex-col gap-0.5">
        <NavLink href="/" on={active === "dashboard"}><LayoutDashboard {...icon} />Dashboard</NavLink>
        <NavLink href="/review" on={active === "review"}>
          <RotateCcw {...icon} /><span className="flex-1">Review queue</span>
          {data.reviewsDue > 0 && <span className="rounded-full bg-developing-bg px-[7px] py-px text-[11px] font-semibold text-developing">{data.reviewsDue}</span>}
        </NavLink>
        <NavLink href="/history" on={active === "history"}><History {...icon} />History</NavLink>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between px-2.5 pb-1">
          <div className="eyebrow text-ink-faint">In progress</div>
          <Link href="/?add=1" aria-label="New course" className="flex items-center gap-1 text-xs font-medium text-ink-muted no-underline hover:text-ink"><Plus size={12} strokeWidth={2} aria-hidden />New</Link>
        </div>
        {inProgress.map((c) => (
          <NavLink key={c.id} href={`/course/${c.id}`} on={active === "map" && c.id === courseId}>
            <span className={cn("size-2 rounded-full", dotFor(c.pct))} aria-hidden />
            <span className="flex-1">{c.name}</span>
            <span className="text-[11px] font-normal text-ink-faint">{c.pct}%</span>
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
            <NavLink key={c.id} href={`/course/${c.id}`} on={active === "map" && c.id === courseId}>
              <CircleCheck size={14} strokeWidth={2} className="text-mastered" aria-hidden />
              <span className="flex-1">{c.name}</span>
            </NavLink>
          ))}
        </details>
      )}

      {course && (
        <div className="flex flex-col gap-0.5">
          <div className="eyebrow px-2.5 pb-1 text-ink-faint">In {course.name}</div>
          <NavLink href={`${base}/tutor`} on={active === "tutor"}><MessageSquare {...icon} />Tutor</NavLink>
          {data.practiceHref && <NavLink href={data.practiceHref} on={active === "practice"}><Mic {...icon} />Practice</NavLink>}
          <NavLink href={`${base}/misconceptions`} on={active === "misconceptions"}><TriangleAlert {...icon} />Misconception log</NavLink>
          <NavLink href={`${base}/files`} on={active === "files"}><FolderOpen {...icon} />Course files</NavLink>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2.5">
        {active === "dashboard" && data.streak > 0 && (
          <div className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5">
            <Flame size={20} strokeWidth={1.8} className="text-developing" aria-hidden />
            <div>
              <div className="text-[13px] font-semibold">{data.streak}-day streak</div>
              <div className="text-[11px] text-ink-faint">Prove one concept today</div>
            </div>
          </div>
        )}
        <div className="border-t border-line pt-2">
          <NavLink href="/settings" on={active === "settings"}><Settings {...icon} />Settings</NavLink>
        </div>
      </div>
    </nav>
  );
}
