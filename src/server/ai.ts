import "server-only";
import { google } from "@ai-sdk/google";

/** The Gemini path turns on when a key is present. Without one, the heuristic demo judges run instead. */
export const aiEnabled = () => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
export const model = () => google(process.env.GEMINI_MODEL ?? "gemini-3.8-flash");
