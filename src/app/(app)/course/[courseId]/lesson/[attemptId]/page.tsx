import { withUserPage } from "@proveit/server/userBoundary";
import { notFound } from "next/navigation";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { LessonFlow } from "@proveit/app/_components/practice/LessonFlow";
import { orNotFound } from "@proveit/server/page";
import { getCourse, getRemediation } from "@proveit/server/store";

export const dynamic = "force-dynamic";

async function LessonPage({ params }: PageProps<"/course/[courseId]/lesson/[attemptId]">) {
  const { courseId, attemptId } = await params;
  const { r, courseName } = orNotFound(() => ({ r: getRemediation(attemptId), courseName: getCourse(courseId).name }));
  if (r.courseId !== courseId) notFound();
  return (
    <AppShell active="practice" courseId={courseId} state={r.state} crumbs={[{ label: courseName, href: `/course/${courseId}` }, { label: r.conceptName }]} right="Lesson, then a new question">
      <LessonFlow r={r} />
    </AppShell>
  );
}

export default withUserPage(LessonPage);

export const metadata = { title: "Lesson" };
