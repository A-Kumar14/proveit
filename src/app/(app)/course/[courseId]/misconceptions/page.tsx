import { withUserPage } from "@proveit/server/userBoundary";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { EmptyState } from "@proveit/app/_components/shell/EmptyState";
import { ListPage, RowItem, Rows } from "@proveit/app/_components/shell/ListPage";
import { orNotFound } from "@proveit/server/page";
import { getCourse, getMisconceptionLog } from "@proveit/server/store";

export const dynamic = "force-dynamic";

async function MisconceptionLogPage({ params }: PageProps<"/course/[courseId]/misconceptions">) {
  const { courseId } = await params;
  const { course, log } = orNotFound(() => ({ course: getCourse(courseId), log: getMisconceptionLog(courseId) }));
  return (
    <AppShell active="misconceptions" courseId={courseId} crumbs={[{ label: course.name, href: `/course/${courseId}` }, { label: "Misconception log" }]}>
      <ListPage eyebrow="Caught in your answers" title="Misconception log">
        {log.length === 0 ? (
          <EmptyState title="Nothing caught yet" body="When an answer shows a specific misconception, it's listed here." action={{ label: "Open the course map", href: `/course/${courseId}` }} />
        ) : (
          <Rows>
            {log.map((m) => (
              <RowItem key={m.key}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-sm font-semibold">{m.name}</span><span className="text-xs text-ink-muted">· {m.concept}</span></div>
                  {m.quote && <div className="mt-1 text-[0.8125rem] text-ink-3">You said &ldquo;{m.quote}&rdquo;</div>}
                  <div className="mt-1 text-[0.8125rem] leading-normal text-ink-muted">{m.gap}</div>
                </div>
              </RowItem>
            ))}
          </Rows>
        )}
      </ListPage>
    </AppShell>
  );
}

export default withUserPage(MisconceptionLogPage);

export const metadata = { title: "Misconceptions" };
