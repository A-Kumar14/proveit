"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SignBridgeHealth, SignBridgePrediction } from "@proveit/lib/signbridge";

const LIVE_INTERVAL_MS = 220;
const STABLE_FRAMES_REQUIRED = 4;
const CONFIDENT_SIGN_THRESHOLD = 0.75;

export type SignState = "off" | "starting" | "live";

/**
 * Spells with the camera. A held ASL letter that stays steady for four frames is added to `letters`.
 * The same letter is not added twice until the hand moves. Camera frames go to the local ASL Assistant
 * service and are never stored. Without that service the hook stops with a message that says how to start it.
 */
export function useSignSpelling() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const captureRef = useRef<HTMLCanvasElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const session = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const active = useRef(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const candidate = useRef<{ label: string; frames: number } | null>(null);
  const accepted = useRef<string | null>(null);
  const released = useRef(0);
  const [state, setState] = useState<SignState>("off");
  const [status, setStatus] = useState("Camera off.");
  const [error, setError] = useState<string | null>(null);
  const [letters, setLetters] = useState("");
  const [tracking, setTracking] = useState<{ label: string; confidence: number; frames: number } | null>(null);

  const clearOverlay = () => {
    const c = overlayRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
  };

  const stop = useCallback(() => {
    active.current = false;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    clearOverlay();
    const id = session.current;
    session.current = null;
    if (id) void fetch("/api/signbridge/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: id }) }).catch(() => {});
    setTracking(null);
    setState("off");
    setStatus("Camera off.");
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stop(); };
  }, [stop]);

  function frame(): string {
    const video = videoRef.current;
    const canvas = captureRef.current;
    if (!video || !canvas || !video.videoWidth) throw new Error("The camera isn't ready yet.");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("The camera frame could not be read.");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Only the base64 body goes to the service.
    return canvas.toDataURL("image/jpeg", 0.72).replace(/^data:[^,]*,/, "");
  }

  function draw(result: SignBridgePrediction) {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    if (!result.landmarks || !result.handDetected) return clearOverlay();
    const box = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const w = video.videoWidth * scale;
    const h = video.videoHeight * scale;
    const ox = (canvas.width - w) / 2;
    const oy = (canvas.height - h) / 2;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#1f1f1f";
    ctx.lineWidth = Math.max(1.5, canvas.width / 420);
    for (const [x, y] of result.landmarks) {
      ctx.beginPath();
      ctx.arc(ox + x * w, oy + y * h, Math.max(3, canvas.width / 160), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function take(result: SignBridgePrediction) {
    draw(result);
    const letter = result.handDetected && result.source === "static" && /^[A-Z]$/.test(result.label) && result.confidence !== null && result.confidence >= CONFIDENT_SIGN_THRESHOLD;
    if (!letter) {
      candidate.current = null;
      released.current += 1;
      if (released.current >= 3) accepted.current = null;
      setTracking(null);
      setStatus(result.handDetected ? "Hold one ASL letter steady." : "Show one hand to the camera.");
      return;
    }
    released.current = 0;
    const cur = candidate.current;
    candidate.current = cur?.label === result.label ? { label: cur.label, frames: cur.frames + 1 } : { label: result.label, frames: 1 };
    const frames = candidate.current.frames;
    const confidence = result.confidence ?? 0;
    if (accepted.current === result.label) {
      setTracking({ label: result.label, confidence, frames: STABLE_FRAMES_REQUIRED });
      setStatus(`Got ${result.label}. Move your hand before signing it again.`);
      return;
    }
    if (frames >= STABLE_FRAMES_REQUIRED) {
      accepted.current = result.label;
      setLetters((s) => `${s}${result.label}`);
      setTracking({ label: result.label, confidence, frames });
      setStatus(`Added ${result.label}.`);
      return;
    }
    setTracking({ label: result.label, confidence, frames });
    setStatus(`Reading ${result.label}, hold steady.`);
  }

  async function tick() {
    if (!active.current || inFlight.current) return;
    if (!videoRef.current?.videoWidth) {
      timer.current = window.setTimeout(() => void tick(), 100);
      return;
    }
    const id = session.current;
    if (!id) return;
    inFlight.current = true;
    try {
      const image = frame();
      const res = await fetch("/api/signbridge/predict", { method: "POST", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: id, image }) });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "The sign service didn't answer.");
      const parsed = SignBridgePrediction.safeParse(payload);
      if (!parsed.success) throw new Error("The sign service sent something unexpected.");
      if (!active.current || !mounted.current || session.current !== id) return;
      take(parsed.data);
      setError(null);
    } catch (e) {
      if (active.current) {
        setError(e instanceof Error ? e.message : "Sign recognition stopped.");
        active.current = false;
        setStatus("Recognition stopped. Start the camera again to retry.");
      }
    } finally {
      inFlight.current = false;
      if (active.current) timer.current = window.setTimeout(() => void tick(), LIVE_INTERVAL_MS);
    }
  }

  const start = useCallback(async () => {
    if (state !== "off") return;
    setState("starting");
    setError(null);
    candidate.current = null;
    accepted.current = null;
    released.current = 0;
    setStatus("Checking the sign service.");
    try {
      const res = await fetch("/api/signbridge/health", { cache: "no-store" }).catch(() => null);
      const payload: unknown = await res?.json().catch(() => null);
      if (!res?.ok || !SignBridgeHealth.safeParse(payload).success) {
        throw new Error("The sign service isn't running on this computer. In a terminal, run: .venv-signbridge/bin/python examples/signbridge/service.py");
      }
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't use the camera.");
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (!mounted.current) { s.getTracks().forEach((t) => t.stop()); return; }
      stream.current = s;
      session.current = crypto.randomUUID();
      if (!videoRef.current) throw new Error("The camera preview could not start.");
      videoRef.current.srcObject = s;
      await videoRef.current.play();
      if (!mounted.current) return;
      active.current = true;
      setState("live");
      setStatus("Show one hand to the camera.");
      void tick();
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      session.current = null;
      setError(e instanceof Error ? e.message : "The camera could not start.");
      setState("off");
      setStatus("Camera off.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const backspace = useCallback(() => setLetters((s) => s.slice(0, -1)), []);
  const space = useCallback(() => setLetters((s) => (s.endsWith(" ") ? s : `${s} `)), []);
  const clear = useCallback(() => { setLetters(""); accepted.current = null; candidate.current = null; }, []);

  return { videoRef, overlayRef, captureRef, state, status, error, letters, tracking, start, stop, backspace, space, clear };
}
