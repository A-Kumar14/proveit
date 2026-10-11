"use client";

import { useState } from "react";
import { cn } from "@proveit/lib/cn";
import { useSettings } from "@proveit/lib/settings";
import { useVoiceSupport } from "../voice/speech";
import type { Prefs } from "@proveit/lib/prefs";
import { AccessibilitySettings } from "./AccessibilitySettings";
import { DataSettings } from "./DataSettings";
import { TutorSettings } from "./TutorSettings";
import { usePrefs } from "./usePrefs";
import { VoiceSettings } from "./VoiceSettings";
import { Segmented } from "./Segmented";
import { SettingRow } from "./SettingRow";
import { Switch } from "./Switch";

const TABS = [{ id: "learning", label: "Learning" }, { id: "tutor", label: "Tutor" }, { id: "voice", label: "Voice" }, { id: "data", label: "Data and privacy" }, { id: "accessibility", label: "Accessibility Features" }] as const;

/** Only settings that change behavior are listed. Each is stored in this browser. */
export function SettingsPanel({ initialPrefs, courses }: { initialPrefs: Prefs; courses: { id: string; name: string }[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("learning");
  const [s, update] = useSettings();
  const canTalk = useVoiceSupport();
  const { prefs, update: updatePrefs, error } = usePrefs(initialPrefs);
  return (
    <div className="flex gap-8">
      <div role="tablist" aria-label="Settings sections" aria-orientation="vertical" className="flex w-[200px] shrink-0 flex-col gap-0.5">
        {TABS.map((t) => (
          <button key={t.id} role="tab" type="button" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="settings-panel" onClick={() => setTab(t.id)}
            className={cn("cursor-pointer rounded-sm border-0 px-3 py-[9px] text-left text-sm", tab === t.id ? "bg-surface-active font-semibold text-ink" : "bg-transparent font-medium text-ink-muted")}>
            {t.label}
          </button>
        ))}
      </div>
      <section id="settings-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-w-0 max-w-2xl flex-1">
        {tab === "learning" && (
          <>
            <h2 className="m-0 mb-1 text-lg font-semibold">Learning</h2>
            <SettingRow title="Answer by" description={canTalk ? "Talk opens voice mode on practice questions. You can still switch to typing from there." : "Talk needs Chrome, Edge or Safari. This browser can only type."}>
              <Segmented label="Answer by" value={s.answerMode} onChange={(answerMode) => update({ answerMode })} options={[{ value: "type", label: "Type" }, { value: "talk", label: "Talk" }]} />
            </SettingRow>
            <SettingRow title="Show hints" description="Show the hint button on the new question after a lesson.">
              <Switch label="Show hints" checked={s.showHints} onChange={(showHints) => update({ showHints })} />
            </SettingRow>
          </>
        )}
        {tab === "tutor" && <TutorSettings prefs={prefs} update={updatePrefs} />}
        {tab === "voice" && <VoiceSettings prefs={prefs} update={updatePrefs} />}
        {tab === "data" && <DataSettings courses={courses} />}
        {tab === "accessibility" && <AccessibilitySettings />}
        {error && <p role="alert" className="mt-3 text-xs text-needswork-text">{error}</p>}
      </section>
    </div>
  );
}
