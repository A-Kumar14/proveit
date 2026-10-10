import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { AddCourseModal } from "@proveit/app/_components/shell/AddCourseModal";
import { buttonStyles } from "@proveit/app/_components/Button";
import { ConnectCalendarModal } from "@proveit/app/_components/calendar/ConnectCalendarModal";
import { CalendarCard } from "@proveit/app/_components/dashboard/CalendarCard";
import { CourseTicker } from "@proveit/app/_components/dashboard/CourseTicker";
import { TickerCard } from "@proveit/app/_components/dashboard/TickerCard";
import { TodoCard } from "@proveit/app/_components/dashboard/TodoCard";
import { RankCard } from "@proveit/app/_components/dashboard/RankCard";
import { RankChip } from "@proveit/app/_components/dashboard/RankChip";
import { MasteryOverview, RecentActivity, StudyWeek } from "@proveit/app/_components/dashboard/Widgets";
import { getScheduledTodos, getSchedule } from "@proveit/server/schedule";
import { getCourse, getDashboard, getDashboardWidgets, getRewards, listCourses } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const { add, connect } = await searchParams;
  const head = getDashboard();
  const courses = listCourses();
  const widgets = getDashboardWidgets();
  const rewards = getRewards();
  const demo = courses[0];
  return (
    <AppShell
      active="dashboard"
      crumbs={[{ label: head.greeting }, { label: head.dateLabel }]}
      right={<div className="flex items-center gap-3"><RankChip r={rewards} /><Link href="/?add=1" className={buttonStyles({ size: "md" })}><Plus size={13} strokeWidth={2.4} aria-hidden />Add a course</Link></div>}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
        <div className="flex flex-col gap-8">
          <section aria-labelledby="courses-heading" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h1 id="courses-heading" className="m-0 text-[22px] font-semibold">Courses</h1>
              <Link href="/courses" className="text-xs text-ink-muted no-underline hover:text-ink">View all and manage</Link>
            </div>
            <CourseTicker count={courses.length}>{courses.map((c) => <TickerCard key={c.id} c={c} />)}</CourseTicker>
          </section>

          <div className="grid grid-cols-2 items-start gap-4">
            <TodoCard groups={getScheduledTodos()} />
            <CalendarCard schedule={getSchedule()} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <RankCard r={rewards} previewable={process.env.NEXT_PUBLIC_DEMO_MODE === "1"} />
            <MasteryOverview d={widgets} />
            <StudyWeek d={widgets} />
            <RecentActivity d={widgets} />
          </div>
        </div>
      </div>
      {add && demo && <AddCourseModal demoCourseId={demo.id} demoConcepts={getCourse(demo.id).total} />}
      {connect && <ConnectCalendarModal closeHref="/" />}
    </AppShell>
  );
}
