import { CourseMapCard } from "@proveit/app/_components/mastery/CourseMapCard";
import { FilesPanel, MisconceptionPanel, PracticePanel, TutorPanel } from "@proveit/app/_components/course/CoursePanels";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { orNotFound } from "@proveit/server/page";
import { getCourse, getFiles, getMisconceptionLog, getReviewBase } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: PageProps<"/course/[courseId]">) {
  const { courseId } = await params;
  const { course, review, log, files } = orNotFound(() => ({
    course: getCourse(courseId),
    review: getReviewBase(courseId),
    log: getMisconceptionLog(courseId),
    files: getFiles(courseId).files,
  }));
  const first = course.concepts[0];
  return (
    <AppShell active="map" courseId={courseId} crumbs={[{ label: course.name }]} right={course.deadline}>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
        {first ? (
          <div className="flex flex-col gap-4">
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
