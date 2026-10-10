import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { Log } from "@proveit/app/_components/shell/Log";
import { AssistantMessage } from "@proveit/app/_components/chat/AssistantMessage";
import { ChipRow } from "@proveit/app/_components/chat/ChipRow";
import { UserBubble } from "@proveit/app/_components/chat/UserBubble";
import { MasteryReviewCard } from "@proveit/app/_components/mastery/MasteryReviewCard";
import { RegenerateButton } from "@proveit/app/_components/mastery/RegenerateButton";
import { aiEnabled } from "@proveit/server/ai";
import { orNotFound } from "@proveit/server/page";
import { getCourse, getReviewBase } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default async function TutorPage({ params }: PageProps<"/course/[courseId]/tutor">) {
  const { courseId } = await params;
  const { course, base } = orNotFound(() => ({ course: getCourse(courseId), base: getReviewBase(courseId) }));
  const chips = [
    ...(base.nextHref && course.nextUp ? [{ label: `Quiz me on ${course.nextUp.name}`, href: base.nextHref }] : []),
    { label: "Open my misconception log", href: `/course/${courseId}/misconceptions` },
    { label: "See the course map", href: `/course/${courseId}` },
  ];
  return (
    <AppShell active="tutor" courseId={courseId} crumbs={[{ label: course.name, href: `/course/${courseId}` }, { label: "Tutor" }]} right={<RegenerateButton />}>
      <Log>
        <UserBubble>How am I doing in {course.name}? What should I fix before the quiz on {course.deadline.replace("Quiz ", "")}?</UserBubble>
        <AssistantMessage><MasteryReviewCard courseId={courseId} courseName={course.name} base={base} aiWritten={aiEnabled()} /></AssistantMessage>
      </Log>
      <ChipRow chips={chips} />
    </AppShell>
  );
}
