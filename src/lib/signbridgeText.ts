export type RecognizedSignKind = "letter" | "sign";

export function appendRecognizedSignText(
  draft: string,
  text: string,
  kind: RecognizedSignKind,
  startsTranscript: boolean,
) {
  if (kind === "letter") {
    const separator = startsTranscript && draft && !/\s$/.test(draft) ? " " : "";
    return `${draft}${separator}${text}`;
  }

  const separator = draft && !/\s$/.test(draft) ? " " : "";
  return `${draft}${separator}${text.replaceAll("_", " ")} `;
}
