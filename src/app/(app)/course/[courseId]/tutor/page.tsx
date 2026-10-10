import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { Log } from "@proveit/app/_components/shell/Log";
import { AssistantMessage } from "@proveit/app/_components/chat/AssistantMessage";
import { UserBubble } from "@proveit/app/_components/chat/UserBubble";
import { MasteryReviewCard } from "@proveit/app/_components/mastery/MasteryReviewCard";
import { aiEnabled } from "@proveit/server/ai";
import { orNotFound } from "@proveit/server/page";
import { getCourse, getReviewBase } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default async function TutorPage({ params }: PageProps<"/course/[courseId]/tutor">) {
  const { courseId } = await params;
  const { course, base } = orNotFound(() => ({ course: getCourse(courseId), base: getReviewBase(courseId) }));
  return (
    <AppShell active="tutor" courseId={courseId} crumbs={[{ label: course.name, href: `/course/${courseId}` }, { label: "Tutor" }]}>
      <Log>
        <UserBubble>How am I doing in {course.name}?</UserBubble>
        <AssistantMessage><MasteryReviewCard courseId={courseId} base={base} aiWritten={aiEnabled()} /></AssistantMessage>
      </Log>
    </AppShell>
  );
}
