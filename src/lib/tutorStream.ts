import { ApiError } from "./schemas";
import type { TutorMessage } from "./schemas";

/** Posts the chat and hands each piece of the reply to `onText` as it arrives. Resolves with the full reply. */
export async function streamTutor(
  input: { courseId: string; messages: TutorMessage[]; files: File[]; signal?: AbortSignal; /** Another streaming route that takes the same form, such as /api/guide. */ endpoint?: string; /** Extra form fields for that route. */ fields?: Record<string, string> },
  onText: (soFar: string) => void,
): Promise<string> {
  const form = new FormData();
  form.set("courseId", input.courseId);
  form.set("messages", JSON.stringify(input.messages));
  for (const [k, v] of Object.entries(input.fields ?? {})) form.set(k, v);
  for (const f of input.files) form.append("files", f);
  let res: Response;
  try {
    res = await fetch(input.endpoint ?? "/api/tutor", { method: "POST", body: form, signal: input.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new Error("Can't reach the server. Check your connection and retry.");
  }
  if (!res.ok) {
    const json: unknown = await res.json().catch(() => null);
    throw new Error(ApiError.safeParse(json).data?.error ?? "The tutor didn't answer. Retry.");
  }
  if (!res.body) throw new Error("The tutor didn't answer. Retry.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  text += decoder.decode();
  onText(text);
  return text;
}
