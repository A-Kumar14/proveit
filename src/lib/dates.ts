/** Local-date helpers shared by the calendar views. Dates are bucketed by the server's local day. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const monthKey = (d: Date) => dayKey(d).slice(0, 7);
export const parseDay = (key: string) => new Date(`${key}T00:00:00`);
export const addDaysTo = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const isDayKey = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDay(s).getTime());
export const isMonthKey = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const dayHeading = (d: Date, today: Date) => {
  const diff = Math.round((parseDay(dayKey(d)).getTime() - parseDay(dayKey(today)).getTime()) / 86_400_000);
  const base = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  return diff === 0 ? `Today, ${base}` : diff === 1 ? `Tomorrow, ${base}` : base;
};

/** "just now", "5 min ago", "3 hr ago", "2 days ago". */
export function ago(ms: number, now = Date.now()) {
  const m = Math.max(0, Math.round((now - ms) / 60_000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago`;
}
