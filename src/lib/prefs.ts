import { z } from "zod";

/** Voices a student can pick. Only these ids ever reach ElevenLabs, so a browser can't ask for another voice. */
export const TUTOR_VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", about: "Warm, steady" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", about: "Calm, clear" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", about: "Soft, friendly" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", about: "Deep, relaxed" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", about: "Formal, measured" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", about: "Bright, upbeat" },
] as const;
export const DEFAULT_VOICE = TUTOR_VOICES[0].id;
export const isTutorVoice = (id: unknown): id is string => TUTOR_VOICES.some((v) => v.id === id);

const F = {
  tutorVoice: z.string().refine(isTutorVoice),
  /** How long a pause ends the student's turn in the older speech mode, in seconds. */
  pauseSeconds: z.union([z.literal(1), z.literal(1.6), z.literal(2.5)]),
  startMuted: z.boolean(),
  /** How much the tutor says. */
  detail: z.enum(["brief", "detailed"]),
  /** Whether it asks questions first or explains first. */
  approach: z.enum(["questions", "direct"]),
  quickReplies: z.boolean(),
  quizLength: z.union([z.literal(5), z.literal(8), z.literal(12)]),
};

export const Prefs = z.object({
  tutorVoice: F.tutorVoice.default(DEFAULT_VOICE),
  pauseSeconds: F.pauseSeconds.default(1.6),
  startMuted: F.startMuted.default(false),
  detail: F.detail.default("brief"),
  approach: F.approach.default("questions"),
  quickReplies: F.quickReplies.default(true),
  quizLength: F.quizLength.default(8),
});
export type Prefs = z.infer<typeof Prefs>;
/** A change to some of the choices. No defaults here, so a patch never overwrites what it doesn't mention. */
export const PrefsPatch = z.object(F).partial().strict();
export const DEFAULT_PREFS: Prefs = Prefs.parse({});
