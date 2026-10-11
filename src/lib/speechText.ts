/** What the tutor says out loud. Drops the quick-reply line and markup, since a voice would read the symbols. */
export function forSpeech(raw: string): string {
  return raw
    .replace(/\n?OPTIONS:[^]*$/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
