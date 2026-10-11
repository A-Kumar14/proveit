import { withUserPage } from "@proveit/server/userBoundary";
import { notFound } from "next/navigation";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { TransferFlow } from "@proveit/app/_components/practice/TransferFlow";
import { orNotFound } from "@proveit/server/page";
import { getCourse, getTransferChallenge } from "@proveit/server/store";

export const dynamic = "force-dynamic";

async function TransferPage({ params }: PageProps<"/course/[courseId]/transfer/[attemptId]">) {
  const { courseId, attemptId } = await params;
  const { r, courseName } = orNotFound(() => ({ r: getTransferChallenge(attemptId), courseName: getCourse(courseId).name }));
  if (r.courseId !== courseId) notFound();
  return (
    <AppShell active="practice" courseId={courseId} state={r.state} crumbs={[{ label: courseName, href: `/course/${courseId}` }, { label: r.conceptName }]} right="New question, same idea">
      <TransferFlow r={r} />
    </AppShell>
  );
}

export default withUserPage(TransferPage);

export const metadata = { title: "New question" };
