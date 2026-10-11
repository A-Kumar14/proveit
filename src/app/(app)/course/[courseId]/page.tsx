import { after } from "next/server";
import { withUserPage } from "@proveit/server/userBoundary";
import { warmCourseSpecs } from "@proveit/server/specWarmup";
import { runAsUser, scopedUserId } from "@proveit/server/userScope";
import { CourseMapCard } from "@proveit/app/_components/mastery/CourseMapCard";
import { FilesPanel, MisconceptionPanel, PracticePanel, TutorPanel } from "@proveit/app/_components/course/CoursePanels";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { orNotFound } from "@proveit/server/page";
import { CourseRankBar } from "@proveit/app/_components/dashboard/CourseRankBar";
import { getCourse, getCourseRanks, getFiles, getMisconceptionLog, getReviewBase } from "@proveit/server/store";

export const dynamic = "force-dynamic";

async function CoursePage({ params, searchParams }: PageProps<"/course/[courseId]">) {
  const { courseId } = await params;
  const { built } = await searchParams;
  const { course, review, log, files, rank } = orNotFound(() => ({
    course: getCourse(courseId),
    review: getReviewBase(courseId),
    log: getMisconceptionLog(courseId),
    files: getFiles(courseId).files,
    rank: getCourseRanks().find((r) => r.courseId === courseId),
  }));
  // Courses you added get their learning content written in the background, so the first click on a concept isn't a wait.
  const owner = scopedUserId();
  after(() => runAsUser(owner, () => warmCourseSpecs(courseId)));
  const first = course.concepts[0];
  return (
    <AppShell active="map" courseId={courseId} crumbs={[{ label: course.name }]} right={course.deadline}>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
        {first ? (
          <div className="flex flex-col gap-4">
            {built && <p role="status" className="m-0 rounded-md border border-mastered-line bg-mastered-bg px-3 py-2 text-[0.8125rem] text-mastered-text">{course.name} is ready. The concept map was built from your files.</p>}
            {rank && <section aria-label="Course rank" className="rounded-md border border-line bg-surface px-4 py-3"><CourseRankBar rank={rank} /></section>}
            <CourseMapCard course={course} initialId={course.nextUp?.id ?? first.id} />
            <div className="grid grid-cols-2 items-start gap-4">
              <TutorPanel courseId={courseId} review={review} />
              <PracticePanel courseId={courseId} />
              <MisconceptionPanel courseId={courseId} log={log} />
              <FilesPanel courseId={courseId} files={files} />
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-line p-6 text-sm text-ink-muted">No concepts yet for this course.</div>
        )}
      </div>
    </AppShell>
  );
}

export default withUserPage(CoursePage);


export const metadata = { title: "Course map" };
