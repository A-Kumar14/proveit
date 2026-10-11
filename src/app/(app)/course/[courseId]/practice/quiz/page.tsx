import { withUserPage } from "@proveit/server/userBoundary";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { ListPage } from "@proveit/app/_components/shell/ListPage";
import { QuizRunner } from "@proveit/app/_components/quiz/QuizRunner";
import { orNotFound } from "@proveit/server/page";
import { getCourse } from "@proveit/server/store";

export const dynamic = "force-dynamic";

async function QuizPage({ params, searchParams }: PageProps<"/course/[courseId]/practice/quiz">) {
  const { courseId } = await params;
  const { concept } = await searchParams;
  const course = orNotFound(() => getCourse(courseId));
  const focus = typeof concept === "string" ? course.concepts.find((c) => c.id === concept) : undefined;
  return (
    <AppShell active="practice" courseId={courseId} crumbs={[{ label: course.name, href: `/course/${courseId}` }, { label: "Practice", href: `/course/${courseId}/practice` }, { label: "Quiz" }]}>
      <ListPage eyebrow="Practice" title="Quiz">
        <QuizRunner key={focus?.id ?? "all"} courseId={courseId} courseName={course.name} conceptId={focus?.id} conceptName={focus?.name} />
      </ListPage>
    </AppShell>
  );
}

export default withUserPage(QuizPage);

export const metadata = { title: "Quiz" };
