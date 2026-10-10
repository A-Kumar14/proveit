/**
 * Splits a list of slots, where one concept may fill several, into parts for parallel model calls.
 * A concept's slots always stay together, so two calls never write about the same concept.
 * Parts are filled evenly, and fewer parts come back when there are not enough concepts to share.
 */
export function splitByConcept<T extends { id: string }>(slots: T[], parts: number): T[][] {
  const groups = new Map<string, T[]>();
  for (const s of slots) groups.set(s.id, [...(groups.get(s.id) ?? []), s]);
  const out: T[][] = Array.from({ length: Math.max(1, Math.min(parts, groups.size)) }, () => []);
  for (const g of [...groups.values()].sort((a, b) => b.length - a.length)) {
    out.reduce((least, p) => (p.length < least.length ? p : least)).push(...g);
  }
  return out.filter((p) => p.length > 0);
}
