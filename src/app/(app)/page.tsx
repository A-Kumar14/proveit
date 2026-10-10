import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { Log } from "@proveit/app/_components/shell/Log";
import { AssistantMessage } from "@proveit/app/_components/chat/AssistantMessage";
import { ReviewCard } from "@proveit/app/_components/mastery/ReviewCard";
import Link from "next/link";
import { getDashboard } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const d = getDashboard();
  return (
    <AppShell
      active="dashboard"
      crumbs={[{ label: d.greeting }]}
      right={d.dateLabel}
    >
      <Log>
        <AssistantMessage>
          <ReviewCard d={d} />
        </AssistantMessage>
        <div className="flex gap-2 pl-[42px]">
          {d.courses.map((c) => (
            <Link key={c.id} href={`/course/${c.id}/tutor`} className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-3 no-underline hover:bg-surface-hover">How am I doing in {c.name}?</Link>
          ))}
        </div>
      </Log>
    </AppShell>
  );
}
