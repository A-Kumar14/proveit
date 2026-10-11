"use client";

import { useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { TUTOR_VOICES, type Prefs } from "@proveit/lib/prefs";
import { cn } from "@proveit/lib/cn";
import { Segmented } from "./Segmented";
import { SettingRow } from "./SettingRow";
import { Switch } from "./Switch";

const SAMPLE = "Hi, I'm your tutor. Tell me what you think this idea means, and we'll take it from there.";

/** Which voice the tutor speaks with on a call, and how calls start. */
export function VoiceSettings({ prefs, update }: { prefs: Prefs; update: (p: Partial<Prefs>) => void }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  function stop() { audio.current?.pause(); audio.current = null; setPlaying(null); }

  async function preview(id: string) {
    if (playing === id) return stop();
    stop();
    setNote(null);
    setPlaying(id);
    try {
      const res = await fetch("/api/voice/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: SAMPLE, voiceId: id }) });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = new Audio(url);
      audio.current = a;
      a.onended = () => { URL.revokeObjectURL(url); setPlaying(null); };
      await a.play();
    } catch {
      setPlaying(null);
      setNote("Previews need the ElevenLabs key on the server. Your choice still saves.");
    }
  }

  return (
    <>
      <h2 className="m-0 mb-1 text-lg font-semibold">Voice</h2>
      <SettingRow stacked title="Tutor voice" description="The voice you hear on a call. It applies to your next call.">
        <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
          {TUTOR_VOICES.map((v) => {
            const on = prefs.tutorVoice === v.id;
            return (
              <li key={v.id} className={cn("flex items-center gap-2 rounded-md border bg-surface px-3 py-2", on ? "border-ink" : "border-line")}>
                <button type="button" aria-pressed={on} onClick={() => update({ tutorVoice: v.id })} className="flex min-w-0 flex-1 cursor-pointer flex-col items-start border-0 bg-transparent p-0 text-left">
                  <span className="text-sm font-semibold">{v.name}{on && <span className="ml-2 text-[0.6875rem] font-medium text-ink-muted">Selected</span>}</span>
                  <span className="text-xs text-ink-muted">{v.about}</span>
                </button>
                <button type="button" onClick={() => void preview(v.id)} aria-label={playing === v.id ? `Stop ${v.name}` : `Hear ${v.name}`} className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line-button bg-surface text-ink hover:bg-surface-hover">
                  {playing === v.id ? <Square size={11} fill="currentColor" aria-hidden /> : <Play size={11} fill="currentColor" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
        {note && <p role="status" className="m-0 mt-2 text-xs text-ink-muted">{note}</p>}
      </SettingRow>
      <SettingRow title="Start calls muted" description="Join with your microphone off. Tap the orb when you're ready to talk.">
        <Switch label="Start calls muted" checked={prefs.startMuted} onChange={(startMuted) => update({ startMuted })} />
      </SettingRow>
      <SettingRow title="Pause before the tutor answers" description="Only used by the browser's own speech mode, which takes over when the ElevenLabs voice isn't set up. Live calls manage their own turn-taking.">
        <Segmented label="Pause before the tutor answers" value={prefs.pauseSeconds} onChange={(pauseSeconds) => update({ pauseSeconds })} options={[{ value: 1, label: "Short" }, { value: 1.6, label: "Normal" }, { value: 2.5, label: "Long" }]} />
      </SettingRow>
    </>
  );
}
