import Link from "next/link";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { EmptyState } from "@proveit/app/_components/shell/EmptyState";
import { ListPage, RowItem, Rows } from "@proveit/app/_components/shell/ListPage";
import { buttonStyles } from "@proveit/app/_components/Button";
import { orNotFound } from "@proveit/server/page";
import { getCourse, getMisconceptionLog } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default async function MisconceptionLogPage({ params }: PageProps<"/course/[courseId]/misconceptions">) {
  const { courseId } = await params;
  const { course, log } = orNotFound(() => ({ course: getCourse(courseId), log: getMisconceptionLog(courseId) }));
  return (
    <AppShell active="misconceptions" courseId={courseId} crumbs={[{ label: course.name, href: `/course/${courseId}` }, { label: "Misconception log" }]}>
      <ListPage eyebrow="Caught in your answers" title="Misconception log">
        {log.length === 0 ? (
          <EmptyState title="Nothing caught yet" body="When an answer shows a specific misconception, it's logged here until you pass a new question on it." action={{ label: "Open the course map", href: `/course/${courseId}` }} />
        ) : (
          <Rows>
            {log.map((m) => (
              <RowItem key={m.key}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-sm font-semibold">{m.name}</span><span className="text-xs text-ink-muted">· {m.concept}</span></div>
                  {m.quote && <div className="mt-0.5 truncate text-xs text-ink-3">&ldquo;{m.quote}&rdquo;</div>}
                  <div className="mt-0.5 text-xs text-ink-faint">{m.note}</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.open ? "bg-needswork-bg text-needswork-text" : "bg-mastered-bg text-mastered-text"}`}>{m.open ? "Unresolved" : "Repaired"}</span>
                <Link href={m.href} className={buttonStyles({ variant: "secondary", size: "sm" })}>{m.open ? "Fix it" : "Review"}</Link>
              </RowItem>
            ))}
          </Rows>
        )}
      </ListPage>
    </AppShell>
  );
}
