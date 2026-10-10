import { withUserPage } from "@proveit/server/userBoundary";
import { SwitchToVoice } from "@proveit/app/_components/voice/SwitchToVoice";
import { VoiceSession } from "@proveit/app/_components/voice/VoiceSession";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { PracticeFlow } from "@proveit/app/_components/practice/PracticeFlow";
import { orNotFound } from "@proveit/server/page";
import { clarify, getAttempt, getQuestion } from "@proveit/server/store";

export const dynamic = "force-dynamic";

async function PracticePage({ params, searchParams }: PageProps<"/course/[courseId]/practice/[conceptId]">) {
  const { courseId, conceptId } = await params;
  const { clarify: clarifyId, mode } = await searchParams;
  const modeParam = typeof mode === "string" ? mode : undefined;
  const { q, resume } = orNotFound(() => {
    const q = getQuestion(courseId, conceptId);
    const prior = typeof clarifyId === "string" ? getAttempt(clarifyId) : null;
    const resume = prior && prior.conceptId === conceptId ? { attemptId: prior.id, answer: prior.answer, followUp: clarify(prior.id).followUp } : undefined;
    return { q, resume };
  });
  const uploads = { enabled: true, demo: true };
  if (modeParam === "speak") return <VoiceSession courseId={courseId} question={q} typeHref={`/course/${courseId}/practice/${conceptId}?mode=type`} uploads={uploads} />;
  return (
    <AppShell active="practice" courseId={courseId} state={q.state} crumbs={[{ label: q.courseName, href: `/course/${courseId}` }, { label: q.conceptName }]} right={<SwitchToVoice href={`/course/${courseId}/practice/${conceptId}?mode=speak`} />}>
      <PracticeFlow key={resume?.attemptId ?? "new"} courseId={courseId} question={q} resume={resume} uploads={uploads} modeParam={modeParam} />
    </AppShell>
  );
}

export default withUserPage(PracticePage);
