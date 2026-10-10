import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { AddCourseModal } from "@proveit/app/_components/shell/AddCourseModal";
import { buttonStyles } from "@proveit/app/_components/Button";
import { CourseTicker } from "@proveit/app/_components/dashboard/CourseTicker";
import { TickerCard } from "@proveit/app/_components/dashboard/TickerCard";
import { DueForReview, MasteryOverview, NeedsAttention, RecentActivity, StudyWeek, UpNext, UpcomingQuizzes } from "@proveit/app/_components/dashboard/Widgets";
import { getCourse, getDashboard, getDashboardWidgets, listCourses } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const { add } = await searchParams;
  const head = getDashboard();
  const courses = listCourses();
  const widgets = getDashboardWidgets();
  const demo = courses[0];
  return (
    <AppShell
      active="dashboard"
      crumbs={[{ label: head.greeting }, { label: head.dateLabel }]}
      right={<Link href="/?add=1" className={buttonStyles({ size: "md" })}><Plus size={13} strokeWidth={2.4} aria-hidden />Add a course</Link>}
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

          <div className="grid grid-cols-2 gap-4">
            <UpNext d={widgets} />
            <NeedsAttention d={widgets} />
            <DueForReview d={widgets} />
            <MasteryOverview d={widgets} />
            <UpcomingQuizzes d={widgets} />
            <StudyWeek d={widgets} />
            <RecentActivity d={widgets} />
          </div>
        </div>
      </div>
      {add && demo && <AddCourseModal demoCourseId={demo.id} demoConcepts={getCourse(demo.id).total} />}
    </AppShell>
  );
}
