import "server-only";
import { google } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

/**
 * OpenRouter wins when OPENROUTER_API_KEY is set, otherwise the Gemini API key is used.
 * With neither, the heuristic demo judges run instead.
 */
export const aiEnabled = () => Boolean(process.env.OPENROUTER_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
export const aiProvider = (): "openrouter" | "google" | null =>
  process.env.OPENROUTER_API_KEY ? "openrouter" : process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "google" : null;

export const model = () => {
  if (aiProvider() === "openrouter") {
    return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })(process.env.OPENROUTER_MODEL || "google/gemini-3.8-flash");
  }
  return google(process.env.GEMINI_MODEL || "gemini-3.8-flash");
};
