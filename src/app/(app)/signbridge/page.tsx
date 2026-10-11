import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { SignBridgeDemo } from "@proveit/app/_components/signbridge/SignBridgeDemo";

export const dynamic = "force-dynamic";

export default function SignBridgePage() {
  return (
    <AppShell active="signbridge" crumbs={[{ label: "ASL Assistant" }]}>
      <div className="flex min-h-0 flex-1 overflow-y-auto px-4 lg:px-7 py-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex max-w-2xl flex-col gap-2">
              <span className="eyebrow">A sign-to-speech conversation</span>
              <h1 className="m-0 text-[1.75rem] font-semibold tracking-tight text-ink">ASL Assistant</h1>
              <p className="m-0 text-sm leading-6 text-ink-muted">
                Capture a held ASL letter or a short movement, review the result, and turn your signs into a spoken message.
              </p>
            </div>
            <span className="text-sm text-ink-muted">Model setup: <code>docs/signbridge.md</code></span>
          </header>

          <SignBridgeDemo />
        </div>
      </div>
    </AppShell>
  );
}

export const metadata = { title: "ASL Assistant" };
