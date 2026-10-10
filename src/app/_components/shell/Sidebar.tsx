import Link from "next/link";
import { BarChart3, Flame, LayoutDashboard, Map as MapIcon, MessageSquare, Mic, Settings } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import type { SidebarView } from "@proveit/server/store";

export type NavKey = "dashboard" | "map" | "practice" | "tutor" | "settings";

const item = (on: boolean) =>
  cn("flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-sm no-underline", on ? "bg-surface-active font-semibold text-ink" : "text-ink-muted hover:bg-surface-hover");

const dotFor = (pct: number) => (pct >= 40 ? "bg-mastered" : pct > 0 ? "bg-developing" : "bg-surface-strong");

export function Sidebar({ data, active, courseId }: { data: SidebarView; active: NavKey; courseId?: string }) {
  const course = data.courses.find((c) => c.id === courseId);
  return (
    <nav aria-label="Sidebar" className="flex w-[232px] shrink-0 flex-col gap-3.5 border-r border-line bg-surface-sidebar px-3.5 py-4">
      <Link href="/" className="flex items-center gap-2.5 px-1 pb-0.5 no-underline text-ink">
        <span className="flex size-7 items-center justify-center rounded-md bg-ink">
          <BarChart3 size={16} strokeWidth={2.2} className="text-white" aria-hidden />
        </span>
        <span className="text-base font-semibold tracking-tight">Mastery</span>
      </Link>

      <div className="flex flex-col gap-0.5">
        <Link href="/" aria-current={active === "dashboard" ? "page" : undefined} className={item(active === "dashboard")}>
          <LayoutDashboard size={16} strokeWidth={1.8} aria-hidden />
          Dashboard
        </Link>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="eyebrow px-2.5 pb-1 text-ink-faint">Courses</div>
        {data.courses.map((c) => (
          <Link key={c.id} href={`/course/${c.id}`} aria-current={active === "map" && c.id === courseId ? "page" : undefined} className={item(active === "map" && c.id === courseId)}>
            <span className={cn("size-2 rounded-full", dotFor(c.pct))} aria-hidden />
            <span className="flex-1">{c.name}</span>
            <span className="text-[11px] font-normal text-ink-faint">{c.pct}%</span>
          </Link>
        ))}
      </div>

      {course && (
        <div className="flex flex-col gap-0.5">
          <div className="eyebrow px-2.5 pb-1 text-ink-faint">In {course.name}</div>
          <Link href={`/course/${course.id}`} className={item(false)}>
            <MapIcon size={16} strokeWidth={1.8} aria-hidden />
            Course map
          </Link>
          <Link href={`/course/${course.id}/tutor`} aria-current={active === "tutor" ? "page" : undefined} className={item(active === "tutor")}>
            <MessageSquare size={16} strokeWidth={1.8} aria-hidden />
            Tutor
          </Link>
          {data.practiceHref && (
            <Link href={data.practiceHref} aria-current={active === "practice" ? "page" : undefined} className={item(active === "practice")}>
              <Mic size={16} strokeWidth={1.8} aria-hidden />
              Practice
            </Link>
          )}
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
          <Link href="/settings" aria-current={active === "settings" ? "page" : undefined} className={item(active === "settings")}>
            <Settings size={16} strokeWidth={1.8} aria-hidden />
            Settings
          </Link>
        </div>
      </div>
    </nav>
  );
}
