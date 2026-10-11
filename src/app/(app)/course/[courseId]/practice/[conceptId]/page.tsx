import { redirect } from "next/navigation";
import { withUserPage } from "@proveit/server/userBoundary";
import { SwitchToVoice } from "@proveit/app/_components/voice/SwitchToVoice";
import { VoiceSession } from "@proveit/app/_components/voice/VoiceSession";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { PracticeFlow } from "@proveit/app/_components/practice/PracticeFlow";
import { SessionChat } from "@proveit/app/_components/practice/SessionChat";
import { aiEnabled } from "@proveit/server/ai";
import { orNotFoundAsync } from "@proveit/server/page";
import { sessionOpening } from "@proveit/server/session";
import { clarify, ensureQuestion, getQuestion, getAttempt } from "@proveit/server/store";

import { scopedUserId } from "@proveit/server/userScope";

export const dynamic = "force-dynamic";

async function PracticePage({ params, searchParams }: PageProps<"/course/[courseId]/practice/[conceptId]">) {
  const { courseId, conceptId } = await params;
  const { clarify: clarifyId, mode, type } = await searchParams;
  const modeParam = typeof mode === "string" ? mode : undefined;
  const { q, resume } = await orNotFoundAsync(async () => {
    // An old or mistyped link to a follow-up just opens the concept fresh.
    const prior = typeof clarifyId === "string" ? (() => { try { return getAttempt(clarifyId); } catch { return null; } })() : null;
    const q = prior && prior.courseId === courseId && prior.conceptId === conceptId
      ? getQuestion(courseId, conceptId, prior.learningSpecRevision ?? undefined)
      : await ensureQuestion(courseId, conceptId);
    const resume = prior && prior.courseId === courseId && prior.conceptId === conceptId ? { attemptId: prior.id, answer: prior.answer, followUp: clarify(prior.id).followUp } : undefined;
    return { q, resume };
  });
  const uploads = { enabled: true, demo: true };
  // The old voice screen only runs without a model. With one, every "talk it through" link opens the live call.
  if (modeParam === "speak" && aiEnabled()) redirect(`/course/${courseId}/practice/${conceptId}/talk`);
  if (modeParam === "speak") return <VoiceSession courseId={courseId} question={q} typeHref={`/course/${courseId}/practice/${conceptId}?mode=type`} uploads={uploads} />;
  return (
    <AppShell active="practice" courseId={courseId} state={q.state} crumbs={[{ label: q.courseName, href: `/course/${courseId}` }, { label: q.conceptName }]} right={aiEnabled() ? undefined : <SwitchToVoice href={`/course/${courseId}/practice/${conceptId}?mode=speak`} />}>
      {aiEnabled()
        // With a model, testing a concept is a conversation. Without one, it falls back to the fixed question and the offline judges.
        ? <SessionChat key={`${scopedUserId()}:${resume?.attemptId ?? "new"}`} userId={scopedUserId()} courseId={courseId} question={q} opening={sessionOpening(courseId, conceptId)} resume={resume} autoTalk={!resume && typeof type !== "string"} />
        : <PracticeFlow key={resume?.attemptId ?? "new"} courseId={courseId} question={q} resume={resume} uploads={uploads} modeParam={modeParam} />}
    </AppShell>
  );
}

export default withUserPage(PracticePage);


export const metadata = { title: "Test this concept" };
