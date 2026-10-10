"use client";

import { useState } from "react";
import { cn } from "@proveit/lib/cn";
import { useSettings } from "@proveit/lib/settings";
import { useVoiceSupport } from "../voice/speech";
import { Segmented } from "./Segmented";
import { SettingRow } from "./SettingRow";
import { Switch } from "./Switch";

const TABS = [{ id: "learning", label: "Learning" }, { id: "voice", label: "Voice" }] as const;

/** Only settings that change behavior are listed. Each is stored in this browser. */
export function SettingsPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("learning");
  const [s, update] = useSettings();
  const canTalk = useVoiceSupport();
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
        {tab === "voice" && (
          <>
            <h2 className="m-0 mb-1 text-lg font-semibold">Voice</h2>
            <SettingRow title="Read questions aloud" description="The tutor speaks each question when a voice session starts. Turn this off to go straight to listening.">
              <Switch label="Read questions aloud" checked={s.speakQuestions} onChange={(speakQuestions) => update({ speakQuestions })} />
            </SettingRow>
          </>
        )}
      </section>
    </div>
  );
}
