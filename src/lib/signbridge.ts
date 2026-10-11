import { z } from "zod";

export const SignBridgeFrameRequest = z.object({
  sessionId: z.string().uuid(),
  image: z.string().min(1).max(1_400_000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
});

export const SignBridgeResetRequest = z.object({
  sessionId: z.string().uuid(),
});

export const SignBridgePrediction = z.object({
  label: z.string().min(1),
  confidence: z.number().min(0).max(1).nullable(),
  source: z.enum(["static", "motion", "none"]),
  handDetected: z.boolean(),
  landmarks: z.array(
    z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
  ).length(21).nullable().optional(),
  faceDetected: z.boolean().optional(),
  faceLandmarks: z.array(
    z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
  ).length(12).nullable().optional(),
  facialCues: z.object({
    mouthOpen: z.number().min(0).max(1),
    browEyeGap: z.number().min(0).max(5),
  }).nullable().optional(),
});

export const SignBridgeHealth = z.object({
  status: z.literal("ok"),
  ready: z.literal(true),
  model: z.enum(["SignBridge-ML", "SignBridge Hand Landmark MLP"]),
  motionReady: z.boolean().optional(),
  faceTrackingReady: z.boolean().optional(),
});

export const SignBridgeMotionRequest = z.object({
  sessionId: z.string().uuid(),
  frames: z.array(
    z.string().min(1).max(1_400_000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  ).min(2).max(12),
});

export type SignBridgePrediction = z.infer<typeof SignBridgePrediction>;
