"use client";

import { useRef } from "react";
import { RotateCcw, Square, Volume2 } from "lucide-react";
import { A11Y_DEFAULTS, type A11ySettings } from "@proveit/lib/a11y";
import { useSettings } from "@proveit/lib/settings";
import { buttonStyles } from "../Button";
import { collectChunks, readChunks, stopReading, useReadAloudSupport, useReadState } from "../a11y/readAloud";
import { Segmented } from "./Segmented";
import { SettingRow } from "./SettingRow";
import { Switch } from "./Switch";

const FONTS: { value: A11ySettings["readingFont"]; label: string; style?: React.CSSProperties }[] = [
  { value: "default", label: "Default" },
  { value: "lexend", label: "Lexend", style: { fontFamily: "var(--font-lexend)" } },
  { value: "atkinson", label: "Atkinson", style: { fontFamily: "var(--font-atkinson)" } },
  { value: "andika", label: "Andika", style: { fontFamily: "var(--font-andika)" } },
  { value: "opendyslexic", label: "OpenDyslexic", style: { fontFamily: "OpenDyslexic" } },
];
const SPACING = [{ value: "normal", label: "Normal" }, { value: "wide", label: "Wide" }, { value: "wider", label: "Wider" }] as const;
const LINES = [{ value: "normal", label: "Normal" }, { value: "relaxed", label: "Relaxed" }, { value: "loose", label: "Loose" }] as const;
const RATES = [{ value: 0.8, label: "Slower" }, { value: 1, label: "Normal" }, { value: 1.25, label: "Faster" }] as const;
const TEXT = [100, 115, 130, 150].map((v) => ({ value: v as A11ySettings["textSize"], label: `${v}%` }));
const ZOOM = [100, 110, 125, 150].map((v) => ({ value: v as A11ySettings["zoom"], label: `${v}%` }));

const SAMPLE = "A confidence interval gives a range of likely values for something we can't measure directly. A 95% confidence level describes the method: if we repeated the study many times, about 95% of the intervals would contain the true value.";

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="m-0 mt-7 mb-1 border-b border-line pb-2 text-[0.8125rem] font-semibold tracking-wide text-ink-muted uppercase">{children}</h3>;
}

/** Dyslexia and vision support. Every change applies to the whole app straight away, so this page is its own preview. */
export function AccessibilitySettings() {
  const [s, update] = useSettings();
  const canRead = useReadAloudSupport();
  const reading = useReadState();
  const sample = useRef<HTMLParagraphElement>(null);
  const changed = (Object.keys(A11Y_DEFAULTS) as (keyof A11ySettings)[]).some((k) => s[k] !== A11Y_DEFAULTS[k]);
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="m-0 mb-1 text-lg font-semibold">Accessibility Features</h2>
        <button type="button" disabled={!changed} onClick={() => update(A11Y_DEFAULTS)} className={buttonStyles({ variant: "secondary", size: "sm" })}>
          <RotateCcw size={12} strokeWidth={2.2} aria-hidden />Reset to defaults
        </button>
      </div>
      <p className="m-0 text-[0.8125rem] text-ink-muted">Changes apply to every page straight away and are saved in this browser.</p>

      <Heading>Dyslexia support</Heading>
      <SettingRow stacked title="Reading font" description="Fonts with clearer, more distinct letter shapes. OpenDyslexic weights the bottom of each letter so letters are harder to flip.">
        <Segmented label="Reading font" value={s.readingFont} onChange={(readingFont) => update({ readingFont })} options={FONTS} />
      </SettingRow>
      <SettingRow title="Letter spacing" description="More room between letters makes crowded words easier to decode.">
        <Segmented label="Letter spacing" value={s.letterSpacing} onChange={(letterSpacing) => update({ letterSpacing })} options={[...SPACING]} />
      </SettingRow>
      <SettingRow title="Word spacing" description="Clearer gaps show where one word ends and the next begins.">
        <Segmented label="Word spacing" value={s.wordSpacing} onChange={(wordSpacing) => update({ wordSpacing })} options={[...SPACING]} />
      </SettingRow>
      <SettingRow title="Line spacing" description="More space between lines makes it easier to keep your place.">
        <Segmented label="Line spacing" value={s.lineSpacing} onChange={(lineSpacing) => update({ lineSpacing })} options={[...LINES]} />
      </SettingRow>
      <SettingRow title="Line focus" description="Dims everything except a band around the line you are reading. It follows your pointer, the focused control when you use the keyboard, and the spoken word during read aloud.">
        <Switch label="Line focus" checked={s.lineFocus} onChange={(lineFocus) => update({ lineFocus })} />
      </SettingRow>
      <SettingRow title="Read aloud" description={canRead ? "Adds a Read aloud button to the corner of every page. It reads what you have selected, or the whole page, and highlights each word as it is spoken." : "Read aloud needs a browser with speech, such as Chrome, Edge or Safari."}>
        <Switch label="Read aloud" checked={s.readAloud} onChange={(readAloud) => update({ readAloud })} />
      </SettingRow>
      <SettingRow title="Reading speed" description="How fast read aloud speaks.">
        <Segmented label="Reading speed" value={s.readAloudRate} onChange={(readAloudRate) => update({ readAloudRate })} options={[...RATES]} />
      </SettingRow>

      <div className="mt-4 rounded-md border border-line bg-surface-subtle p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="eyebrow">Try it</span>
          {canRead && (reading === "idle"
            ? <button type="button" className={buttonStyles({ variant: "secondary", size: "sm" })} onClick={() => sample.current && readChunks(collectChunks(sample.current), s.readAloudRate)}><Volume2 size={13} strokeWidth={2} aria-hidden />Read this aloud</button>
            : <button type="button" className={buttonStyles({ variant: "secondary", size: "sm" })} onClick={stopReading}><Square size={12} strokeWidth={2.4} aria-hidden />Stop</button>)}
        </div>
        <p ref={sample} className="m-0 max-w-prose text-sm text-ink-2">{SAMPLE}</p>
      </div>

      <Heading>Vision support</Heading>
      <SettingRow title="Text size" description="Makes all text larger. Layout and spacing stay put, so pages keep their shape.">
        <Segmented label="Text size" value={s.textSize} onChange={(textSize) => update({ textSize })} options={TEXT} />
      </SettingRow>
      <SettingRow title="Zoom" description="Scales the whole app, text, icons and controls together, like browser zoom. Pages still fit the window.">
        <Segmented label="Zoom" value={s.zoom} onChange={(zoom) => update({ zoom })} options={ZOOM} />
      </SettingRow>

      <Heading>Voice</Heading>
      <SettingRow title="ASL Assistant" description="Adds sign input to the tutor and Test this concept. Spell a word with ASL letters on camera and it lands in the message box. Needs the local ASL Assistant model service running on this computer.">
        <Switch label="ASL Assistant" checked={s.signInput} onChange={(signInput) => update({ signInput })} />
      </SettingRow>
      <SettingRow title="Read questions aloud" description="The tutor speaks each question when a voice session starts. Turn this off to go straight to listening.">
        <Switch label="Read questions aloud" checked={s.speakQuestions} onChange={(speakQuestions) => update({ speakQuestions })} />
      </SettingRow>
    </>
  );
}
