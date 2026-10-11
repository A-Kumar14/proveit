import { withUserPage } from "@proveit/server/userBoundary";
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
import { DemoResetButton } from "@proveit/app/_components/dashboard/DemoResetButton";
import { RankChip } from "@proveit/app/_components/dashboard/RankChip";
import { currentUserId } from "@proveit/server/auth";
import { connectionStatus } from "@proveit/server/integrations";
import { getScheduledTodos, getSchedule } from "@proveit/server/schedule";
import { getCourseRanks, getDashboard, getRewards, listCourses } from "@proveit/server/store";

export const dynamic = "force-dynamic";

async function Dashboard({ searchParams }: PageProps<"/">) {
  const { add, connect, connected, integration_error: integrationError } = await searchParams;
  const userId = await currentUserId();
  const head = getDashboard();
  const courses = listCourses();
  const rewards = getRewards();
  const ranks = getCourseRanks();
  return (
    <AppShell
      active="dashboard"
      crumbs={[{ label: head.greeting }, { label: head.dateLabel }]}
      right={<div className="flex items-center gap-3"><RankChip r={rewards} /><DemoResetButton /><Link href="/?add=1" className={buttonStyles({ size: "md" })}><Plus size={13} strokeWidth={2.4} aria-hidden />Add a course</Link></div>}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
        <div className="flex flex-col gap-8">
          <RankCard key={userId} userId={userId} r={rewards} courses={ranks} previewable />

          <section aria-labelledby="courses-heading" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h1 id="courses-heading" className="m-0 text-[1.375rem] font-semibold">Courses</h1>
              <Link href="/courses" className="text-xs text-ink-muted no-underline hover:text-ink">View all and manage</Link>
            </div>
            <CourseTicker count={courses.length}>{courses.map((c) => <TickerCard key={c.id} c={c} rank={ranks.find((r) => r.courseId === c.id)} />)}</CourseTicker>
          </section>

          <div className="grid grid-cols-2 items-start gap-4">
            <TodoCard key={userId} userId={userId} groups={getScheduledTodos()} />
            <CalendarCard schedule={getSchedule()} />
          </div>

        </div>
      </div>
      {add && <AddCourseModal apps={connectionStatus(await currentUserId())} notice={{ connected: typeof connected === "string" ? connected : undefined, error: typeof integrationError === "string" ? integrationError : undefined }} />}
      {connect && <ConnectCalendarModal closeHref="/" />}
    </AppShell>
  );
}

export default withUserPage(Dashboard);
