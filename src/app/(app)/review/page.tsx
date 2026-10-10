import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { EmptyState } from "@proveit/app/_components/shell/EmptyState";
import { ListPage, RowItem, Rows } from "@proveit/app/_components/shell/ListPage";
import { buttonStyles } from "@proveit/app/_components/Button";
import { clock } from "@proveit/lib/dates";
import { getReviewSlots, getSchedule } from "@proveit/server/schedule";
import { getReviews, type ReviewItem } from "@proveit/server/store";

export const dynamic = "force-dynamic";

const slotLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short" }) + ", " + clock(iso);

function Section({ title, items, slots }: { title: string; items: ReviewItem[]; slots: Map<string, { start: string }> }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-xs font-medium tracking-[0.06em] text-ink-faint uppercase">{title}</h2>
      <Rows>
        {items.map((i) => {
          const slot = slots.get(i.id);
          return (
            <RowItem key={i.id}>
              <div className="flex-1">
                <div className="text-sm font-semibold">{i.name}</div>
                <div className="text-xs text-ink-muted">{i.courseName}</div>
                {slot && <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted"><CalendarDays size={11} aria-hidden />Suggested {slotLabel(slot.start)}, a free gap in your calendar</div>}
              </div>
              <span className={i.due ? "text-xs font-semibold text-developing-text" : "text-xs text-ink-muted"}>{i.when}</span>
              {i.href && i.due && <Link href={i.href} className={buttonStyles({ size: "sm" })}>Review now</Link>}
            </RowItem>
          );
        })}
      </Rows>
    </section>
  );
}

export default function ReviewPage() {
  const { due, upcoming } = getReviews();
  const { calendar } = getSchedule();
  const slots = getReviewSlots(due.map((d) => d.id));
  return (
    <AppShell active="review" crumbs={[{ label: "Review queue" }]}>
      <ListPage eyebrow="Spaced review" title={due.length ? `${due.length} due for review` : "No reviews due"}>
        <p className="m-0 max-w-xl text-[13px] text-ink-muted">
          Reviews land on the day they&apos;re due, and the suggested times come from free gaps in your {calendar.mode === "ics" ? calendar.provider : "sample"} calendar.{" "}
          <Link href="/calendar" className="text-ink">Open the calendar</Link>
        </p>
        {due.length + upcoming.length === 0 && (
          <EmptyState title="Nothing scheduled yet" body="A concept lands here after you pass a new question on it. Prove one and it comes back tomorrow." />
        )}
        <Section title="Due now" items={due} slots={slots} />
        <Section title="Coming up" items={upcoming} slots={slots} />
      </ListPage>
    </AppShell>
  );
}
