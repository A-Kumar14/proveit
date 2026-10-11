"use client";

import type { Prefs } from "@proveit/lib/prefs";
import { Segmented } from "./Segmented";
import { SettingRow } from "./SettingRow";
import { Switch } from "./Switch";

/** How the tutor talks, and the default length of a quiz. The tutor reads these on the server, so they can't be changed from a chat message. */
export function TutorSettings({ prefs, update }: { prefs: Prefs; update: (p: Partial<Prefs>) => void }) {
  return (
    <>
      <h2 className="m-0 mb-1 text-lg font-semibold">Tutor</h2>
      <SettingRow title="Reply length" description="Brief keeps replies to a few sentences. Detailed allows a worked example when it helps.">
        <Segmented label="Reply length" value={prefs.detail} onChange={(detail) => update({ detail })} options={[{ value: "brief", label: "Brief" }, { value: "detailed", label: "Detailed" }]} />
      </SettingRow>
      <SettingRow title="Teaching style" description="Questions first asks what you think before it explains. Explain first gives the idea plainly, then asks you about it.">
        <Segmented label="Teaching style" value={prefs.approach} onChange={(approach) => update({ approach })} options={[{ value: "questions", label: "Questions first" }, { value: "direct", label: "Explain first" }]} />
      </SettingRow>
      <SettingRow title="Quick replies" description="Show tap-to-answer buttons when the tutor asks which part is confusing, or offers to check what you know.">
        <Switch label="Quick replies" checked={prefs.quickReplies} onChange={(quickReplies) => update({ quickReplies })} />
      </SettingRow>
      <SettingRow title="Quiz length" description="How many questions a course quiz has. A quiz on one concept stays at 4.">
        <Segmented label="Quiz length" value={prefs.quizLength} onChange={(quizLength) => update({ quizLength })} options={[{ value: 5, label: "5" }, { value: 8, label: "8" }, { value: 12, label: "12" }]} />
      </SettingRow>
    </>
  );
}
