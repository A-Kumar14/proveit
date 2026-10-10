import { withUserPage } from "@proveit/server/userBoundary";
import Link from "next/link";
import { CircleAlert, CircleCheck, CircleHelp } from "lucide-react";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { EmptyState } from "@proveit/app/_components/shell/EmptyState";
import { ListPage, RowItem, Rows } from "@proveit/app/_components/shell/ListPage";
import { getDashboard, getEvidenceAttempt, getHistory } from "@proveit/server/store";

export const dynamic = "force-dynamic";

const TONE = { good: [CircleCheck, "text-mastered-text"], warn: [CircleHelp, "text-developing-text"], bad: [CircleAlert, "text-needswork-text"] } as const;

function HistoryPage() {
  const events = getHistory();
  const course = getDashboard().courses[0];
  return (
    <AppShell active="history" crumbs={[{ label: "History" }]}>
      <ListPage eyebrow="Newest first" title="History">
        {events.length === 0 ? (
          <EmptyState title="No attempts yet" body="Each answer you give, and each new question you pass, is logged here." action={course ? { label: "Open the course map", href: `/course/${course.id}` } : undefined} />
        ) : (
          <Rows>
            {events.map((e) => {
              const [Icon, color] = TONE[e.tone];
              const evidence = getEvidenceAttempt(e.id);
              return (
                <RowItem key={e.id}>
                  <Icon size={16} strokeWidth={1.8} className={color} aria-hidden />
                  <Link href={e.href} className="flex-1 text-ink no-underline hover:underline"><div className="text-sm font-semibold">{e.title}</div><div className="text-xs text-ink-muted">{e.detail}</div><div className="mt-1 flex gap-1.5 text-[10px] text-ink-faint"><span className="rounded-full border border-line px-1.5 py-px capitalize">{evidence.kind}</span><span className="rounded-full border border-line px-1.5 py-px capitalize">{evidence.outcome}</span></div></Link>
                  <time dateTime={new Date(e.at).toISOString()} className="text-xs text-ink-faint">{new Date(e.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</time>
                </RowItem>
              );
            })}
          </Rows>
        )}
      </ListPage>
    </AppShell>
  );
}

export default withUserPage(HistoryPage);
