import { withUserPage } from "@proveit/server/userBoundary";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { ListPage } from "@proveit/app/_components/shell/ListPage";
import { PracticeHub } from "@proveit/app/_components/practice/PracticeHub";
import { orNotFound } from "@proveit/server/page";
import { getCourse } from "@proveit/server/store";

export const dynamic = "force-dynamic";

async function PracticeHubPage({ params }: PageProps<"/course/[courseId]/practice">) {
  const { courseId } = await params;
  const course = orNotFound(() => getCourse(courseId));
  return (
    <AppShell active="practice" courseId={courseId} crumbs={[{ label: course.name, href: `/course/${courseId}` }, { label: "Practice" }]}>
      <ListPage eyebrow="Practice" title="Practice">
        <p className="m-0 max-w-xl text-[13px] text-ink-muted">Material built from what you keep getting wrong. To be tested on one concept, use Test this concept on the course map.</p>
        <PracticeHub courseId={courseId} />
      </ListPage>
    </AppShell>
  );
}

export default withUserPage(PracticeHubPage);
