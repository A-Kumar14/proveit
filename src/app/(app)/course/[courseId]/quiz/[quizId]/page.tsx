import { notFound } from "next/navigation";
import { withUserPage } from "@proveit/server/userBoundary";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { ListPage } from "@proveit/app/_components/shell/ListPage";
import { QuizResultView } from "@proveit/app/_components/quiz/QuizResultView";
import { orNotFound } from "@proveit/server/page";
import { getQuizAudit } from "@proveit/server/quiz";

export const dynamic = "force-dynamic";

/** A saved quiz, reopened from History: the score, what it changed on the map, and every answer. */
async function QuizAuditPage({ params }: PageProps<"/course/[courseId]/quiz/[quizId]">) {
  const { courseId, quizId } = await params;
  const result = orNotFound(() => getQuizAudit(quizId));
  if (result.courseId !== courseId) notFound();
  return (
    <AppShell active="practice" courseId={courseId} crumbs={[{ label: result.courseName, href: `/course/${courseId}` }, { label: "History", href: "/history" }, { label: "Quiz review" }]}>
      <ListPage eyebrow="Quiz review" title={`Quiz on ${result.courseName}`}>
        <QuizResultView result={result} />
      </ListPage>
    </AppShell>
  );
}

export default withUserPage(QuizAuditPage);
