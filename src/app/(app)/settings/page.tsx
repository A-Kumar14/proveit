import { withUserPage } from "@proveit/server/userBoundary";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { SettingsPanel } from "@proveit/app/_components/settings/SettingsPanel";
import { getPrefs } from "@proveit/server/prefs";
import { listCourses } from "@proveit/server/store";

export const dynamic = "force-dynamic";

function SettingsPage() {
  return (
    <AppShell active="settings" crumbs={[{ label: "Settings" }]}>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6"><SettingsPanel initialPrefs={getPrefs()} courses={listCourses().map((c) => ({ id: c.id, name: c.name }))} /></div>
    </AppShell>
  );
}

export default withUserPage(SettingsPage);

export const metadata = { title: "Settings" };
