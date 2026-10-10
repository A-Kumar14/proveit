import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { TutorChat } from "@proveit/app/_components/tutor/TutorChat";
import { aiEnabled } from "@proveit/server/ai";
import { orNotFound } from "@proveit/server/page";
import { getCourse, getReviewBase } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default async function TutorPage({ params }: PageProps<"/course/[courseId]/tutor">) {
  const { courseId } = await params;
  const { course, base } = orNotFound(() => ({ course: getCourse(courseId), base: getReviewBase(courseId) }));
  return (
    <AppShell active="tutor" courseId={courseId} crumbs={[{ label: course.name, href: `/course/${courseId}` }, { label: "Tutor" }]}>
      <TutorChat courseId={courseId} courseName={course.name} base={base} aiWritten={aiEnabled()} enabled={aiEnabled()} />
    </AppShell>
  );
}
