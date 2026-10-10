import "server-only";

/** Turns a failed model call into something the student or developer can act on. Never includes the key. */
export function modelErrorMessage(e: unknown, fallback = "The AI call failed. Retry."): string {
  const status = findStatus(e);
  const name = process.env.OPENROUTER_API_KEY ? "OpenRouter" : "Gemini";
  if (status === 401 || status === 403) return `${name} rejected the API key. Check the key in .env and restart the server.`;
  if (status === 402) return `${name} says the account is out of credits. Add credits and retry.`;
  if (status === 429) return `${name} is rate limited or out of quota. Retry in a moment, or check the key's limits.`;
  if (status === 404) return `${name} doesn't know that model. Check the model name in .env.`;
  if (status !== null && status >= 500) return `${name} is having trouble right now. Retry in a moment.`;
  return fallback;
}

function findStatus(e: unknown, depth = 0): number | null {
  if (!e || typeof e !== "object" || depth > 4) return null;
  const o = e as { statusCode?: unknown; lastError?: unknown; cause?: unknown };
  if (typeof o.statusCode === "number") return o.statusCode;
  return findStatus(o.lastError, depth + 1) ?? findStatus(o.cause, depth + 1);
}

/** A failure of another service that the student can act on. The message is safe to show. */
export class UpstreamError extends Error {}
