import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { PracticeFlow } from "@proveit/app/_components/practice/PracticeFlow";
import { orNotFound } from "@proveit/server/page";
import { clarify, getAttempt, getQuestion } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default async function PracticePage({ params, searchParams }: PageProps<"/course/[courseId]/practice/[conceptId]">) {
  const { courseId, conceptId } = await params;
  const { clarify: clarifyId } = await searchParams;
  const { q, resume } = orNotFound(() => {
    const q = getQuestion(courseId, conceptId);
    const prior = typeof clarifyId === "string" ? getAttempt(clarifyId) : null;
    const resume = prior && prior.conceptId === conceptId ? { attemptId: prior.id, answer: prior.answer, followUp: clarify(prior.id).followUp } : undefined;
    return { q, resume };
  });
  return (
    <AppShell active="practice" courseId={courseId} state={q.state} crumbs={[{ label: q.courseName, href: `/course/${courseId}` }, { label: q.conceptName }]} right={q.prompt}>
      <PracticeFlow key={resume?.attemptId ?? "new"} courseId={courseId} question={q} resume={resume} />
    </AppShell>
  );
}
