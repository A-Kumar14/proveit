import { withUserPage } from "@proveit/server/userBoundary";
import { notFound } from "next/navigation";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { ReviewFlow } from "@proveit/app/_components/practice/ReviewFlow";
import { orNotFound } from "@proveit/server/page";
import { getCourse, getReviewChallenge } from "@proveit/server/store";

export const dynamic = "force-dynamic";

async function ReviewConceptPage({ params }: PageProps<"/course/[courseId]/review/[conceptId]">) {
  const { courseId, conceptId } = await params;
  const { r, courseName } = orNotFound(() => ({ r: getReviewChallenge(courseId, conceptId), courseName: getCourse(courseId).name }));
  if (r.courseId !== courseId) notFound();
  return (
    <AppShell active="review" courseId={courseId} state={r.state} crumbs={[{ label: "Review queue", href: "/review" }, { label: courseName, href: `/course/${courseId}` }, { label: r.conceptName }]} right="Delayed retrieval">
      <ReviewFlow r={r} />
    </AppShell>
  );
}

export default withUserPage(ReviewConceptPage);
