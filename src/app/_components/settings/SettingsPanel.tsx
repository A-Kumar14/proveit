"use client";

import { useSettings } from "@proveit/lib/settings";
import { useVoiceSupport } from "../voice/speech";
import { Segmented } from "./Segmented";
import { SettingRow } from "./SettingRow";
import { Switch } from "./Switch";

/** Only settings that change behavior are listed. Each is stored in this browser. */
export function SettingsPanel() {
  const [s, update] = useSettings();
  const canTalk = useVoiceSupport();
  return (
    <section aria-label="Learning" className="max-w-2xl">
      <h2 className="m-0 mb-1 text-lg font-semibold">Learning</h2>
      <SettingRow
        title="Answer by"
        description={canTalk ? "Talk opens voice mode on practice questions. You can still switch to typing from there." : "Talk needs Chrome, Edge or Safari. This browser can only type."}
      >
        <Segmented label="Answer by" value={s.answerMode} onChange={(answerMode) => update({ answerMode })} options={[{ value: "type", label: "Type" }, { value: "talk", label: "Talk" }]} />
      </SettingRow>
      <SettingRow title="Show hints" description="Show the hint button on the new question after a lesson.">
        <Switch label="Show hints" checked={s.showHints} onChange={(showHints) => update({ showHints })} />
      </SettingRow>
    </section>
  );
}
