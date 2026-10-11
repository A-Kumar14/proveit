"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, MoreHorizontal, Trash2 } from "lucide-react";
import { api } from "@proveit/lib/api";
import { cn } from "@proveit/lib/cn";
import type { CourseRow } from "@proveit/server/store";
import { Button } from "../Button";
import { MasteryBar } from "../mastery/MasteryBar";
import { EmptyState } from "../shell/EmptyState";
import { DeleteCourseDialog } from "./DeleteCourseDialog";

type Filter = "all" | "progress" | "completed";
type Menu = { x: number; y: number; ids: string[] };
type Notice = { text: string; undo: { ids: string[]; completed: boolean } | null; error?: boolean };

const FILTERS: { id: Filter; label: string }[] = [{ id: "all", label: "All" }, { id: "progress", label: "In progress" }, { id: "completed", label: "Completed" }];

/** Course list with filters, row selection, a batch "Mark as completed" button, and a right-click menu. */
export function CoursesTable({ rows }: { rows: CourseRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<Menu | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const counts = { all: rows.length, progress: rows.filter((r) => !r.completed).length, completed: rows.filter((r) => r.completed).length };
  const visible = useMemo(() => rows.filter((r) => filter === "all" || (filter === "completed") === r.completed), [rows, filter]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const picked = rows.filter((r) => selected.has(r.id));
  const canComplete = picked.some((r) => !r.completed);
  const canReopen = picked.some((r) => r.completed);
  const allVisible = visible.length > 0 && visible.every((r) => selected.has(r.id));

  const apply = useCallback(async (ids: string[], completed: boolean) => {
    const changed = ids.filter((id) => byId.get(id)?.completed !== completed);
    if (changed.length === 0) return;
    setBusy(true);
    setMenu(null);
    try {
      await api.setCoursesCompleted(changed, completed);
      const names = changed.map((id) => byId.get(id)?.name ?? id);
      const what = names.length === 1 ? names[0] : `${names.length} courses`;
      setNotice({ text: `Marked ${what} as ${completed ? "completed" : "in progress"}.`, undo: { ids: changed, completed: !completed } });
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : "Something went wrong. Retry.", undo: null, error: true });
    }
    setBusy(false);
  }, [byId, router]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected(allVisible ? new Set() : new Set(visible.map((r) => r.id)));
  /** Right-clicking a selected row acts on the whole selection. Anywhere else acts on that row. */
  const targets = (id: string) => (selected.has(id) && selected.size > 1 ? [...selected] : [id]);

  const section = (title: string, list: CourseRow[]) => list.length === 0 ? null : (
    <section key={title} className="flex flex-col gap-2">
      {filter === "all" && <h2 className="m-0 text-xs font-medium tracking-[0.06em] text-ink-faint uppercase">{title} ({list.length})</h2>}
      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-md border border-line p-0">
        {list.map((r) => (
          <li key={r.id} onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, ids: targets(r.id) }); }}
            className={cn("flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0", selected.has(r.id) && "bg-surface-subtle")}>
            <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-4 cursor-pointer accent-ink" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link href={`/course/${r.id}`} className="truncate text-sm font-semibold text-ink no-underline hover:underline">{r.name}</Link>
                {r.completed
                  ? <span className="flex items-center gap-1 rounded-full bg-mastered-bg px-2 py-0.5 text-[0.6875rem] font-semibold text-mastered-text"><CircleCheck size={11} strokeWidth={2.2} aria-hidden />Completed</span>
                  : <span className="rounded-full bg-developing-bg px-2 py-0.5 text-[0.6875rem] font-semibold text-developing-text">In progress</span>}
                {r.manual && <span className="text-[0.6875rem] text-ink-faint">Set by you</span>}
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">{r.proven} of {r.total} concepts mastered{r.openMisconception ? ` · open: ${r.openMisconception}` : ""}</div>
            </div>
            <div className="flex w-40 items-center gap-2">
              <MasteryBar pct={r.pct} barClass={r.pct >= 40 ? "bg-mastered" : "bg-developing"} label={`${r.name} mastery ${r.pct}%`} />
              <span className="w-8 text-right text-xs">{r.pct}%</span>
            </div>
            <button type="button" aria-label={`Actions for ${r.name}`} aria-haspopup="menu" onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); setMenu({ x: b.right - 4, y: b.bottom + 4, ids: targets(r.id) }); }}
              className="flex size-8 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent text-ink-muted hover:bg-surface-hover"><MoreHorizontal size={16} aria-hidden /></button>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter courses" className="flex gap-1 rounded-sm border border-line bg-surface p-[3px]">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
              className={cn("cursor-pointer rounded-[7px] border px-3 py-[6px] text-[0.8125rem]", filter === f.id ? "border-line-button bg-surface font-semibold text-ink" : "border-transparent bg-transparent font-medium text-ink-3")}>
              {f.label} <span className="text-ink-faint">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted" aria-live="polite">{selected.size > 0 ? `${selected.size} selected` : "Select courses to mark them"}</span>
          <Button onClick={() => apply(picked.filter((r) => !r.completed).map((r) => r.id), true)} disabled={!canComplete || busy}>Mark as completed</Button>
          <Button variant="secondary" onClick={() => apply(picked.filter((r) => r.completed).map((r) => r.id), false)} disabled={!canReopen || busy}>Mark as in progress</Button>
        </div>
      </div>

      {visible.length > 0 && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-ink-muted"><input type="checkbox" checked={allVisible} onChange={toggleAll} className="size-4 cursor-pointer accent-ink" />Select all shown</label>
      )}

      {notice && (
        <div role={notice.error ? "alert" : "status"} className={cn("flex items-center justify-between gap-3 rounded-sm border px-3 py-2 text-[0.8125rem]", notice.error ? "border-needswork-line bg-needswork-bg text-needswork-text" : "border-line bg-surface-subtle text-ink-2")}>
          <span>{notice.text}</span>
          <span className="flex gap-2">
            {notice.undo && <button type="button" disabled={busy} onClick={() => apply(notice.undo!.ids, notice.undo!.completed)} className="cursor-pointer border-0 bg-transparent p-0 text-[0.8125rem] font-semibold underline">Undo</button>}
            <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="cursor-pointer border-0 bg-transparent p-0 text-[0.8125rem] text-ink-muted">Dismiss</button>
          </span>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={filter === "completed" ? "No completed courses yet" : "No courses in progress"}
          body={filter === "completed" ? "A course lands here when every concept is Mastered, or when you mark it completed." : "Everything is completed. Add a course to keep going."}
          action={filter === "completed" ? undefined : { label: "Add a course", href: "/?add=1" }}
        />
      ) : (
        <>
          {section("In progress", visible.filter((r) => !r.completed))}
          {section("Completed", visible.filter((r) => r.completed))}
        </>
      )}

      {menu && <RowMenu menu={menu} rows={menu.ids.map((id) => byId.get(id)).filter((r): r is CourseRow => !!r)} onClose={closeMenu} onApply={apply} onDelete={(r) => { setMenu(null); setDeleting({ id: r.id, name: r.name }); }} />}
      {deleting && <DeleteCourseDialog course={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setNotice({ text: `Deleted ${deleting.name}.`, undo: null }); setDeleting(null); setSelected(new Set()); router.refresh(); }} />}
    </div>
  );
}

function RowMenu({ menu, rows, onClose, onApply, onDelete }: { menu: Menu; rows: CourseRow[]; onClose: () => void; onApply: (ids: string[], completed: boolean) => void; onDelete: (row: CourseRow) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const openable = rows.length === 1 ? rows[0] : null;
  const toComplete = rows.filter((r) => !r.completed);
  const toReopen = rows.filter((r) => r.completed);
  const deletable = rows.length === 1 && openable?.removable ? openable : null;

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const close = () => onClose();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
      const i = items.indexOf(document.activeElement as HTMLElement);
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      e.preventDefault();
    };
    // React can run this effect while the click that opened the menu is still travelling up to the window.
    // Listening a moment later keeps that same click from closing the menu again.
    const arm = setTimeout(() => window.addEventListener("click", close), 0);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", key);
    return () => { clearTimeout(arm); window.removeEventListener("click", close); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); window.removeEventListener("keydown", key); };
  }, [onClose]);

  const item = "flex w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2.5 py-2 text-left text-[0.8125rem] text-ink no-underline hover:bg-surface-hover";
  return (
    <div ref={ref} role="menu" aria-label="Course actions" onContextMenu={(e) => e.preventDefault()}
      style={{ left: Math.min(menu.x, window.innerWidth - 232), top: Math.min(menu.y, window.innerHeight - 140) }}
      className="glass fixed z-50 w-56 rounded-md border p-1">
      {openable && <Link role="menuitem" href={`/course/${openable.id}`} className={item}>Open course</Link>}
      {toComplete.length > 0 && <button role="menuitem" type="button" className={item} onClick={() => onApply(toComplete.map((r) => r.id), true)}><CircleCheck size={14} strokeWidth={2} className="text-mastered" aria-hidden />Mark as completed{rows.length > 1 ? ` (${toComplete.length})` : ""}</button>}
      {toReopen.length > 0 && <button role="menuitem" type="button" className={item} onClick={() => onApply(toReopen.map((r) => r.id), false)}>Mark as in progress{rows.length > 1 ? ` (${toReopen.length})` : ""}</button>}
      {deletable && <button role="menuitem" type="button" className={cn(item, "text-needswork-text")} onClick={() => onDelete(deletable)}><Trash2 size={14} strokeWidth={2} aria-hidden />Delete course</button>}
    </div>
  );
}
