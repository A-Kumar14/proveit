import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { AddCourseModal } from "@proveit/app/_components/shell/AddCourseModal";
import { Log } from "@proveit/app/_components/shell/Log";
import { AssistantMessage } from "@proveit/app/_components/chat/AssistantMessage";
import { ChipRow } from "@proveit/app/_components/chat/ChipRow";
import { buttonStyles } from "@proveit/app/_components/Button";
import { ReviewCard } from "@proveit/app/_components/mastery/ReviewCard";
import { getCourse, getDashboard, getReviews } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const { add } = await searchParams;
  const d = getDashboard();
  const c = d.courses[0];
  const chips = [
    ...(c ? [{ label: `How am I doing in ${c.name}?`, href: `/course/${c.id}/tutor` }] : []),
    ...(getReviews().due.length > 0 ? [{ label: "Start my reviews", href: "/review" }] : []),
    { label: "Add a course", href: "/?add=1" },
  ];
  return (
    <AppShell
      active="dashboard"
      crumbs={[{ label: d.greeting }, { label: d.dateLabel }]}
      right={<Link href="/?add=1" className={buttonStyles({ size: "md" })}><Plus size={13} strokeWidth={2.4} aria-hidden />Add a course</Link>}
    >
      <Log>
        <AssistantMessage><ReviewCard d={d} /></AssistantMessage>
      </Log>
      <ChipRow chips={chips} />
      {add && c && <AddCourseModal demoCourseId={c.id} demoConcepts={getCourse(c.id).total} />}
    </AppShell>
  );
}
