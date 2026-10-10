import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { Log } from "@proveit/app/_components/shell/Log";
import { AssistantMessage } from "@proveit/app/_components/chat/AssistantMessage";
import { ReviewCard } from "@proveit/app/_components/mastery/ReviewCard";
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
      </Log>
    </AppShell>
  );
}
