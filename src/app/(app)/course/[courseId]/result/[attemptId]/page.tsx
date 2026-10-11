import { withUserPage } from "@proveit/server/userBoundary";
import { notFound } from "next/navigation";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { Log } from "@proveit/app/_components/shell/Log";
import { AssistantMessage } from "@proveit/app/_components/chat/AssistantMessage";
import { MasteryChangeCard } from "@proveit/app/_components/practice/MasteryChangeCard";
import { orNotFound } from "@proveit/server/page";
import { getResult } from "@proveit/server/store";

export const dynamic = "force-dynamic";

async function ResultPage({ params }: PageProps<"/course/[courseId]/result/[attemptId]">) {
  const { courseId, attemptId } = await params;
  const r = orNotFound(() => getResult(attemptId));
  if (r.courseId !== courseId) notFound();
  return (
    <AppShell active="practice" courseId={courseId} state={r.next} crumbs={[{ label: r.courseName, href: `/course/${courseId}` }, { label: r.conceptName }]} right="Result">
      <Log><AssistantMessage><MasteryChangeCard r={r} /></AssistantMessage></Log>
    </AppShell>
  );
}

export default withUserPage(ResultPage);

export const metadata = { title: "Result" };
