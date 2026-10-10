import { notFound, redirect } from "next/navigation";
import { Paperclip } from "lucide-react";
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
    <AppShell active="practice" courseId={courseId} state={a.state} crumbs={[{ label: courseName, href: `/course/${courseId}` }, { label: a.conceptName }]} right={a.question}>
      <Log>
        <div className="flex max-w-[72%] flex-col items-end gap-1.5 self-end">
          <UserBubble className="max-w-none">{a.answer}</UserBubble>
          {a.attachment && (
            <span className="flex items-center gap-1.5 rounded-full border border-mastered-line bg-mastered-bg px-2.5 py-0.5 text-[11px] text-mastered-text"><Paperclip size={11} strokeWidth={2.2} aria-hidden />{a.attachment} · read as your work</span>
          )}
        </div>
        <AssistantMessage><DiagnosisCard a={a} /></AssistantMessage>
      </Log>
    </AppShell>
  );
}
