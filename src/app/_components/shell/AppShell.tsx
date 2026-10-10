import { currentProfile } from "@proveit/server/auth";
import { getSidebar } from "@proveit/server/store";
import { Sidebar, type NavKey } from "./Sidebar";
import { HeaderBar, type Crumb } from "./HeaderBar";
import type { MasteryState } from "@proveit/lib/schemas";

/** Sidebar + header + a content region. Pages render <Log> and, when they have one, a <ComposerDock>. */
export async function AppShell({ active, courseId, crumbs, state, right, children }: {
  active: NavKey; courseId?: string; crumbs: Crumb[]; state?: MasteryState; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-surface">
      <Sidebar data={getSidebar()} active={active} courseId={courseId} profile={await currentProfile()} />
      <main className="flex min-w-0 flex-1 flex-col">
        <HeaderBar crumbs={crumbs} state={state} right={right} />
        {children}
      </main>
    </div>
  );
}
