import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { Log } from "@proveit/app/_components/shell/Log";
import { ChipRow } from "@proveit/app/_components/chat/ChipRow";
import { AssistantMessage } from "@proveit/app/_components/chat/AssistantMessage";
import { UserBubble } from "@proveit/app/_components/chat/UserBubble";
import { CourseMapCard } from "@proveit/app/_components/mastery/CourseMapCard";
import { orNotFound } from "@proveit/server/page";
import { getCourse } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: PageProps<"/course/[courseId]">) {
  const { courseId } = await params;
  const course = orNotFound(() => getCourse(courseId));
  const crumbs = [{ label: "Dashboard", href: "/" }, { label: course.name }];
  const first = course.concepts[0];
  if (!first) {
    return (
      <AppShell active="map" courseId={courseId} crumbs={crumbs}>
        <Log><div className="rounded-md border border-line p-6 text-sm text-ink-muted">No concepts yet for this course.</div></Log>
      </AppShell>
    );
  }
  return (
    <AppShell active="map" courseId={courseId} crumbs={crumbs} right={course.deadline}>
      <Log>
        <UserBubble>Show me my {course.name} map</UserBubble>
        <AssistantMessage>
          <CourseMapCard course={course} initialId={course.nextUp?.id ?? first.id} />
        </AssistantMessage>
      </Log>
      <ChipRow chips={[
        ...(course.nextUp ? [{ label: `Test ${course.nextUp.name}`, href: `/course/${courseId}/practice/${course.nextUp.id}` }] : []),
        { label: "How am I doing?", href: `/course/${courseId}/tutor` },
        { label: "Misconception log", href: `/course/${courseId}/misconceptions` },
      ]} />
    </AppShell>
  );
}
