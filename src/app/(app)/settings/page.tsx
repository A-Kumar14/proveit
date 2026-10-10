import { withUserPage } from "@proveit/server/userBoundary";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { SettingsPanel } from "@proveit/app/_components/settings/SettingsPanel";

function SettingsPage() {
  return (
    <AppShell active="settings" crumbs={[{ label: "Settings" }]}>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6"><SettingsPanel /></div>
    </AppShell>
  );
}

export default withUserPage(SettingsPage);
