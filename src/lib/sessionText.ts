/**
 * The tutor can end a reply with a line of quick replies for the student: `OPTIONS: first | second | third`.
 * This separates the two, and it also hides a half-streamed marker so the line never flashes on screen.
 */
export function splitOptions(raw: string): { text: string; options: string[] } {
  const i = raw.lastIndexOf("OPTIONS:");
  if (i >= 0) {
    const options = raw.slice(i + "OPTIONS:".length).split("|").map((o) => o.replace(/[*_`"]/g, "").trim()).filter((o) => o.length > 0 && o.length <= 48).slice(0, 3);
    return { text: raw.slice(0, i).trimEnd(), options };
  }
  // The stream may have delivered only the start of the marker so far.
  // It always starts a new line, so a capital O at the end of a sentence is left alone.
  for (let n = "OPTIONS:".length - 1; n >= 1; n--) {
    if (raw.endsWith(`\n${"OPTIONS:".slice(0, n)}`)) return { text: raw.slice(0, raw.length - n).trimEnd(), options: [] };
  }
  return { text: raw, options: [] };
}
