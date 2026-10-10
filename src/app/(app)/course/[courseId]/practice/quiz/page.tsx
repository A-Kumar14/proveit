import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { ListPage } from "@proveit/app/_components/shell/ListPage";
import { QuizRunner } from "@proveit/app/_components/quiz/QuizRunner";
import { orNotFound } from "@proveit/server/page";
import { getCourse } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: PageProps<"/course/[courseId]/practice/quiz">) {
  const { courseId } = await params;
  const course = orNotFound(() => getCourse(courseId));
  return (
    <AppShell active="practice" courseId={courseId} crumbs={[{ label: course.name, href: `/course/${courseId}` }, { label: "Practice", href: `/course/${courseId}/practice` }, { label: "Quiz" }]}>
      <ListPage eyebrow="Practice" title="Quiz">
        <QuizRunner courseId={courseId} courseName={course.name} />
      </ListPage>
    </AppShell>
  );
}
