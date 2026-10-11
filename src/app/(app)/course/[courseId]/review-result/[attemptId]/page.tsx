import { withUserPage } from "@proveit/server/userBoundary";
import { notFound } from "next/navigation";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { ReviewResultCard } from "@proveit/app/_components/practice/ReviewResultCard";
import { orNotFound } from "@proveit/server/page";
import { getReviewResult } from "@proveit/server/store";

export const dynamic = "force-dynamic";

async function ReviewResultPage({ params }: PageProps<"/course/[courseId]/review-result/[attemptId]">) {
  const { courseId, attemptId } = await params;
  const r = orNotFound(() => getReviewResult(attemptId));
  if (r.courseId !== courseId) notFound();
  return (
    <AppShell active="review" courseId={courseId} state="mastered" crumbs={[{ label: "Review queue", href: "/review" }, { label: r.courseName, href: `/course/${courseId}` }, { label: r.conceptName }]} right="Retention verified">
      <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-5 py-7">
        <div className="w-full max-w-[820px]"><ReviewResultCard r={r} /></div>
      </div>
    </AppShell>
  );
}

export default withUserPage(ReviewResultPage);

export const metadata = { title: "Review result" };
