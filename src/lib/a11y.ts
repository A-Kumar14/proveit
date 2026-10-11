/**
 * Accessibility preferences. They live with the other settings in this browser, and apply to the whole app
 * through data attributes and CSS variables on <html>, so components need no changes to honour them.
 */

/** Where useSettings keeps everything. Here rather than in settings.ts, which is client-only, so the root layout can read it. */
export const SETTINGS_KEY = "proveit.settings";

export const READING_FONTS =["default", "lexend", "atkinson", "andika", "opendyslexic"] as const;
export const SPACING = ["normal", "wide", "wider"] as const;
export const LINE_SPACING = ["normal", "relaxed", "loose"] as const;
export const TEXT_SIZES = [100, 115, 130, 150] as const;
/** Capped at 150%: past that the fixed sidebar leaves too little room for the page. */
export const ZOOMS = [100, 110, 125, 150] as const;
export const READ_RATES = [0.8, 1, 1.25] as const;
export const THEMES = ["system", "light", "dark"] as const;

export type ReadingFont = (typeof READING_FONTS)[number];
export type Spacing = (typeof SPACING)[number];
export type LineSpacing = (typeof LINE_SPACING)[number];

export type A11ySettings = {
  readingFont: ReadingFont;
  letterSpacing: Spacing;
  wordSpacing: Spacing;
  lineSpacing: LineSpacing;
  lineFocus: boolean;
  readAloud: boolean;
  readAloudRate: (typeof READ_RATES)[number];
  textSize: (typeof TEXT_SIZES)[number];
  zoom: (typeof ZOOMS)[number];
  /** Light, dark, or follow the operating system. */
  theme: (typeof THEMES)[number];
};

export const A11Y_DEFAULTS: A11ySettings = {
  readingFont: "default", letterSpacing: "normal", wordSpacing: "normal", lineSpacing: "normal",
  lineFocus: false, readAloud: false, readAloudRate: 1, textSize: 100, zoom: 100, theme: "system",
};

const pick = <T,>(options: readonly T[], value: unknown, fallback: T): T => (options.includes(value as T) ? (value as T) : fallback);

export function sanitizeA11y(raw: Partial<Record<keyof A11ySettings, unknown>>): A11ySettings {
  const d = A11Y_DEFAULTS;
  return {
    readingFont: pick(READING_FONTS, raw.readingFont, d.readingFont),
    letterSpacing: pick(SPACING, raw.letterSpacing, d.letterSpacing),
    wordSpacing: pick(SPACING, raw.wordSpacing, d.wordSpacing),
    lineSpacing: pick(LINE_SPACING, raw.lineSpacing, d.lineSpacing),
    lineFocus: typeof raw.lineFocus === "boolean" ? raw.lineFocus : d.lineFocus,
    readAloud: typeof raw.readAloud === "boolean" ? raw.readAloud : d.readAloud,
    readAloudRate: pick(READ_RATES, raw.readAloudRate, d.readAloudRate),
    textSize: pick(TEXT_SIZES, raw.textSize, d.textSize),
    zoom: pick(ZOOMS, raw.zoom, d.zoom),
    theme: pick(THEMES, raw.theme, d.theme),
  };
}

/**
 * Writes the preferences onto <html>. It must stay self-contained (no imports, no outer variables):
 * the root layout also inlines it as a script, so saved preferences apply before the first paint.
 */
export function applyA11y(root: HTMLElement, s: Record<string, unknown>): void {
  const one = (options: readonly unknown[], value: unknown) => (options.indexOf(value) >= 0 ? value : options[0]);
  const font = one(["default", "lexend", "atkinson", "andika", "opendyslexic"], s.readingFont) as string;
  const letter = one(["normal", "wide", "wider"], s.letterSpacing) as string;
  const word = one(["normal", "wide", "wider"], s.wordSpacing) as string;
  const line = one(["normal", "relaxed", "loose"], s.lineSpacing) as string;
  const text = one([100, 115, 130, 150], s.textSize) as number;
  const zoom = one([100, 110, 125, 150], s.zoom) as number;
  const set = (name: string, value: string, off: string) => {
    if (value === off) root.removeAttribute(name);
    else root.setAttribute(name, value);
  };
  set("data-a11y-font", font, "default");
  set("data-a11y-letter", letter, "normal");
  set("data-a11y-word", word, "normal");
  set("data-a11y-line", line, "normal");
  set("data-a11y-zoom", String(zoom), "100");
  root.style.setProperty("--a11y-text", String(text / 100));
  root.style.setProperty("--a11y-zoom", String(zoom / 100));
  const theme = one(["system", "light", "dark"], s.theme) as string;
  const dark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.setAttribute("data-theme", dark ? "dark" : "light");
}

/** Inline <head> script: reads the saved settings and applies them before React hydrates. */
export const a11yBootScript = (storageKey: string) =>
  `try{(${applyA11y.toString()})(document.documentElement,JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)})||"{}"))}catch(e){}`;
