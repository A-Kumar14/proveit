import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { SettingsPanel } from "@proveit/app/_components/settings/SettingsPanel";

export default function SettingsPage() {
  return (
    <AppShell active="settings" crumbs={[{ label: "Settings" }]}>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6"><SettingsPanel /></div>
    </AppShell>
  );
}
