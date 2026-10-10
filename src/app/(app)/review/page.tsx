import Link from "next/link";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { EmptyState } from "@proveit/app/_components/shell/EmptyState";
import { ListPage, RowItem, Rows } from "@proveit/app/_components/shell/ListPage";
import { buttonStyles } from "@proveit/app/_components/Button";
import { getReviews, type ReviewItem } from "@proveit/server/store";

export const dynamic = "force-dynamic";

function Section({ title, items }: { title: string; items: ReviewItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-xs font-medium tracking-[0.06em] text-ink-faint uppercase">{title}</h2>
      <Rows>
        {items.map((i) => (
          <RowItem key={i.id}>
            <div className="flex-1"><div className="text-sm font-semibold">{i.name}</div><div className="text-xs text-ink-muted">{i.courseName}</div></div>
            <span className={i.due ? "text-xs font-semibold text-developing-text" : "text-xs text-ink-muted"}>{i.when}</span>
            {i.href && i.due && <Link href={i.href} className={buttonStyles({ size: "sm" })}>Review now</Link>}
          </RowItem>
        ))}
      </Rows>
    </section>
  );
}

export default function ReviewPage() {
  const { due, upcoming } = getReviews();
  return (
    <AppShell active="review" crumbs={[{ label: "Review queue" }]}>
      <ListPage eyebrow="Spaced review" title={due.length ? `${due.length} due for review` : "No reviews due"}>
        {due.length + upcoming.length === 0 && (
          <EmptyState title="Nothing scheduled yet" body="A concept lands here after you pass a new question on it. Prove one and it comes back tomorrow." />
        )}
        <Section title="Due now" items={due} />
        <Section title="Coming up" items={upcoming} />
      </ListPage>
    </AppShell>
  );
}
