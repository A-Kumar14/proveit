import { notFound, redirect } from "next/navigation";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { Log } from "@proveit/app/_components/shell/Log";
import { AssistantMessage } from "@proveit/app/_components/chat/AssistantMessage";
import { UserBubble } from "@proveit/app/_components/chat/UserBubble";
import { DiagnosisCard } from "@proveit/app/_components/practice/DiagnosisCard";
import { orNotFound } from "@proveit/server/page";
import { getAttempt, getCourse } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default async function DiagnosisPage({ params }: PageProps<"/course/[courseId]/diagnosis/[attemptId]">) {
  const { courseId, attemptId } = await params;
  const { a, courseName } = orNotFound(() => ({ a: getAttempt(attemptId), courseName: getCourse(courseId).name }));
  if (a.courseId !== courseId) notFound();
  if (a.evaluation.verdict === "uncertain") redirect(`/course/${courseId}/practice/${a.conceptId}`);
  return (
    <AppShell active="practice" courseId={courseId} state={a.state} crumbs={[{ label: courseName, href: `/course/${courseId}` }, { label: a.conceptName }]}>
      <Log>
        <UserBubble>{a.answer}</UserBubble>
        <AssistantMessage><DiagnosisCard a={a} /></AssistantMessage>
      </Log>
    </AppShell>
  );
}
