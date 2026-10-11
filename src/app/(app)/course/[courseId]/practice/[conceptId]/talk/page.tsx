import { withUserPage } from "@proveit/server/userBoundary";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { TalkChat } from "@proveit/app/_components/voice/TalkChat";
import { orNotFoundAsync } from "@proveit/server/page";
import { sessionOpening } from "@proveit/server/session";
import { ensureQuestion } from "@proveit/server/store";

import { scopedUserId } from "@proveit/server/userScope";

export const dynamic = "force-dynamic";

async function TalkPage({ params }: PageProps<"/course/[courseId]/practice/[conceptId]/talk">) {
  const { courseId, conceptId } = await params;
  const q = await orNotFoundAsync(() => ensureQuestion(courseId, conceptId));
  return (
    <AppShell active="practice" courseId={courseId} state={q.state} crumbs={[{ label: q.courseName, href: `/course/${courseId}` }, { label: q.conceptName, href: `/course/${courseId}/practice/${conceptId}` }, { label: "Speech mode" }]}>
      <TalkChat key={scopedUserId()} userId={scopedUserId()} courseId={courseId} conceptId={conceptId} opening={sessionOpening(courseId, conceptId)} chatHref={`/course/${courseId}/practice/${conceptId}`} />
    </AppShell>
  );
}

export default withUserPage(TalkPage);

