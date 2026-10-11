"use client";

import { useEffect, useRef, useState } from "react";
import { SignBridgeHealth, SignBridgePrediction } from "@proveit/lib/signbridge";
import { Button, buttonStyles } from "@proveit/app/_components/Button";
import { cn } from "@proveit/lib/cn";

const LIVE_INTERVAL_MS = 220;
const STABLE_FRAMES_REQUIRED = 4;
const CONFIDENT_SIGN_THRESHOLD = 0.75;
const MOTION_FRAME_COUNT = 12;
const MOTION_FRAME_INTERVAL_MS = 125;
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
] as const;
const FACE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [6, 7], [8, 9], [10, 11],
] as const;

function modelDisplayName(model: string) {
  if (model === "SignBridge-ML") return "Trained sign model";
  if (model === "SignBridge Hand Landmark MLP") return "Local hand landmark model";
  return model;
}

export function SignBridgeDemo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<string | null>(null);
  const liveTimerRef = useRef<number | null>(null);
  const predictionAbortRef = useRef<AbortController | null>(null);
  const motionAbortRef = useRef<AbortController | null>(null);
  const startingRef = useRef(false);
  const activeRef = useRef(false);
  const mountedRef = useRef(true);
  const candidateRef = useRef<{ label: string; frames: number } | null>(null);
  const acceptedRef = useRef<string | null>(null);
  const releaseFramesRef = useRef(0);
  const liveRequestRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const motionCaptureRef = useRef(false);
  const speakOnCaptureRef = useRef(false);
  const [status, setStatus] = useState("Start the camera to begin live sign recognition.");
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<ReturnType<typeof SignBridgeHealth.parse> | null>(null);
  const [prediction, setPrediction] = useState<SignBridgePrediction | null>(null);
  const [suggestion, setSuggestion] = useState<SignBridgePrediction | null>(null);
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [recognizingMotion, setRecognizingMotion] = useState(false);
  const [speakOnCapture, setSpeakOnCapture] = useState(false);

  const clearRecognitionSession = (sessionId: string) => {
    void fetch("/api/signbridge/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch((cleanupError: unknown) => {
      console.error("ASL Assistant camera session cleanup failed.", cleanupError);
    });
  };

  const clearLandmarkCanvas = () => {
    const canvas = landmarkCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const stopCamera = () => {
    activeRef.current = false;
    predictionAbortRef.current?.abort();
    motionAbortRef.current?.abort();
    motionCaptureRef.current = false;
    if (liveTimerRef.current !== null) window.clearTimeout(liveTimerRef.current);
    liveTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    clearLandmarkCanvas();
    if (sessionRef.current) clearRecognitionSession(sessionRef.current);
    sessionRef.current = null;
    setRunning(false);
    setRecognizingMotion(false);
    setStatus("Camera stopped.");
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRef.current = false;
      predictionAbortRef.current?.abort();
      motionAbortRef.current?.abort();
      if (liveTimerRef.current !== null) window.clearTimeout(liveTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (sessionRef.current) clearRecognitionSession(sessionRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const captureFrame = async () => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error("Wait until the camera preview is ready, then try again.");
    }
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The camera frame could not be prepared.");
    const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.62));
    if (!blob) throw new Error("The camera frame could not be encoded.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  };

  const requestPrediction = async (image: string, sessionId = sessionRef.current) => {
    if (!sessionId) throw new Error("Start the camera before recognizing a sign.");
    const controller = new AbortController();
    predictionAbortRef.current = controller;
    try {
      const response = await fetch("/api/signbridge/predict", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, image }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "The ASL Assistant model request failed.");
      const parsed = SignBridgePrediction.safeParse(payload);
      if (!parsed.success) throw new Error("The ASL Assistant service returned an invalid prediction.");
      return parsed.data;
    } finally {
      if (predictionAbortRef.current === controller) predictionAbortRef.current = null;
    }
  };

  const drawTrackingOverlay = (result: SignBridgePrediction) => {
    const canvas = landmarkCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.round(bounds.width * pixelRatio);
    const height = Math.round(bounds.height * pixelRatio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const renderedWidth = video.videoWidth * scale;
    const renderedHeight = video.videoHeight * scale;
    const offsetX = (canvas.width - renderedWidth) / 2;
    const offsetY = (canvas.height - renderedHeight) / 2;
    if (result.landmarks && result.handDetected) {
      context.lineWidth = Math.max(2, canvas.width / 320);
      context.strokeStyle = "#f08a55";
      for (const [start, end] of HAND_CONNECTIONS) {
        const [x1, y1] = result.landmarks[start];
        const [x2, y2] = result.landmarks[end];
        context.beginPath();
        context.moveTo(offsetX + x1 * renderedWidth, offsetY + y1 * renderedHeight);
        context.lineTo(offsetX + x2 * renderedWidth, offsetY + y2 * renderedHeight);
        context.stroke();
      }
      context.fillStyle = "#fffaf5";
      context.strokeStyle = "#b75e32";
      context.lineWidth = Math.max(1.5, canvas.width / 420);
      for (const [x, y] of result.landmarks) {
        context.beginPath();
        context.arc(offsetX + x * renderedWidth, offsetY + y * renderedHeight, Math.max(3, canvas.width / 150), 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
    }
    if (result.faceLandmarks && result.faceDetected) {
      context.lineWidth = Math.max(1.5, canvas.width / 500);
      context.strokeStyle = "#65d6c4";
      for (const [start, end] of FACE_CONNECTIONS) {
        const [x1, y1] = result.faceLandmarks[start];
        const [x2, y2] = result.faceLandmarks[end];
        context.beginPath();
        context.moveTo(offsetX + x1 * renderedWidth, offsetY + y1 * renderedHeight);
        context.lineTo(offsetX + x2 * renderedWidth, offsetY + y2 * renderedHeight);
        context.stroke();
      }
    }
  };

  const appendRecognizedSign = (label: string) => {
    setMessage((current) => `${current}${label}`);
    if (speakOnCaptureRef.current && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(label));
    }
  };

  const processLivePrediction = (result: SignBridgePrediction) => {
    setPrediction(result);
    drawTrackingOverlay(result);
    const isConfidentLetter = result.handDetected
      && result.source === "static"
      && /^[A-Z]$/.test(result.label)
      && result.confidence !== null
      && result.confidence >= CONFIDENT_SIGN_THRESHOLD;

    if (!isConfidentLetter) {
      candidateRef.current = null;
      releaseFramesRef.current += 1;
      if (releaseFramesRef.current >= 3) acceptedRef.current = null;
      if (!result.handDetected) {
        setSuggestion(null);
        setStatus("Show one hand in the guide to begin spelling.");
      } else if (result.source === "static" && /^[A-Z]$/.test(result.label)) {
        setSuggestion(result);
        setStatus(`Possible ${result.label} · ${Math.round((result.confidence ?? 0) * 100)}% score. Hold steady or review before adding.`);
      } else {
        setSuggestion(null);
        setStatus("Hand tracked. Hold an ASL letter clearly for live recognition.");
      }
      return;
    }

    releaseFramesRef.current = 0;
    setSuggestion(null);
    const current = candidateRef.current;
    candidateRef.current = current?.label === result.label
      ? { label: current.label, frames: current.frames + 1 }
      : { label: result.label, frames: 1 };
    const stableFrames = candidateRef.current.frames;

    if (acceptedRef.current === result.label) {
      setStatus(`Tracking ${result.label}. Move to a different pose before repeating the same letter.`);
      return;
    }
    if (stableFrames >= STABLE_FRAMES_REQUIRED) {
      acceptedRef.current = result.label;
      appendRecognizedSign(result.label);
      setStatus(`Recognized ${result.label} · ${Math.round((result.confidence ?? 0) * 100)}% model score.`);
      return;
    }
    setStatus(`Tracking ${result.label}… hold steady (${stableFrames}/${STABLE_FRAMES_REQUIRED}).`);
  };

  const trackNextFrame = async () => {
    if (!activeRef.current || liveRequestRef.current || motionCaptureRef.current) return;
    if (!videoRef.current?.videoWidth) {
      liveTimerRef.current = window.setTimeout(() => void trackNextFrame(), 100);
      return;
    }
    const sessionId = sessionRef.current;
    if (!sessionId) return;
    liveRequestRef.current = true;
    try {
      const result = await requestPrediction(await captureFrame(), sessionId);
      if (!activeRef.current || !mountedRef.current || sessionRef.current !== sessionId) return;
      consecutiveFailuresRef.current = 0;
      processLivePrediction(result);
      setError(null);
    } catch (trackingError) {
      if (activeRef.current) {
        consecutiveFailuresRef.current += 1;
        setError(trackingError instanceof Error ? trackingError.message : "Live hand recognition failed.");
        setStatus("Connection interrupted. Keeping the camera on and retrying recognition.");
      }
    } finally {
      liveRequestRef.current = false;
      if (activeRef.current) {
        const retryDelay = Math.min(500 * 2 ** Math.min(consecutiveFailuresRef.current, 3), 4_000);
        liveTimerRef.current = window.setTimeout(
          () => void trackNextFrame(),
          consecutiveFailuresRef.current ? retryDelay : LIVE_INTERVAL_MS,
        );
      }
    }
  };

  const startCamera = async () => {
    if (running || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    setHealth(null);
    setPrediction(null);
    setSuggestion(null);
    consecutiveFailuresRef.current = 0;
    candidateRef.current = null;
    acceptedRef.current = null;
    releaseFramesRef.current = 0;
    setStatus("Checking the local ASL Assistant service…");
    let parsedHealth: ReturnType<typeof SignBridgeHealth.parse> | null = null;
    try {
      const response = await fetch("/api/signbridge/health", { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      const parsed = SignBridgeHealth.safeParse(payload);
      if (!response.ok || !parsed.success) {
        throw new Error(typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "The local ASL Assistant model service is not ready.");
      }
      parsedHealth = parsed.data;
      setHealth(parsed.data);
    } catch (healthError) {
      setError(healthError instanceof Error ? healthError.message : "The local ASL Assistant model service is not ready.");
    }

    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not support camera access.");
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 480 },
          height: { ideal: 360 },
          frameRate: { ideal: 15, max: 24 },
        },
        audio: false,
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      sessionRef.current = crypto.randomUUID();
      if (!videoRef.current) throw new Error("The camera preview could not be started.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (!mountedRef.current) return;
      setRunning(true);
      if (parsedHealth) {
        activeRef.current = true;
        setStatus("Camera ready. Hold an ASL letter in the guide for live transcription.");
        void trackNextFrame();
      } else {
        setStatus("Camera preview only. Start the local hand-aware model service for live transcription.");
      }
    } catch (cameraError) {
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      sessionRef.current = null;
      setError(`Camera access failed: ${cameraError instanceof Error ? cameraError.message : "Camera access was blocked."}`);
      setStatus("Camera permission required.");
    } finally {
      startingRef.current = false;
      if (mountedRef.current) setStarting(false);
    }
  };

  const captureMovement = async () => {
    const sessionId = sessionRef.current;
    if (!running || !sessionId || recognizingMotion || !health?.motionReady) return;
    motionCaptureRef.current = true;
    setRecognizingMotion(true);
    setError(null);
    setSuggestion(null);
    setStatus("Recording a short sequence. Sign one movement clearly…");
    try {
      while (liveRequestRef.current && activeRef.current && sessionRef.current === sessionId) {
        await new Promise((resolve) => window.setTimeout(resolve, 20));
      }
      if (!activeRef.current || sessionRef.current !== sessionId) return;
      const frames: string[] = [];
      for (let index = 0; index < MOTION_FRAME_COUNT; index += 1) {
        frames.push(await captureFrame());
        if (index < MOTION_FRAME_COUNT - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, MOTION_FRAME_INTERVAL_MS));
        }
      }
      if (!activeRef.current || sessionRef.current !== sessionId) return;
      const controller = new AbortController();
      motionAbortRef.current = controller;
      const response = await fetch("/api/signbridge/motion", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, frames }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "The motion model request failed.");
      const parsed = SignBridgePrediction.safeParse(payload);
      if (!parsed.success) throw new Error("The ASL Assistant service returned an invalid motion prediction.");
      if (!mountedRef.current || !activeRef.current || sessionRef.current !== sessionId) return;
      setPrediction(parsed.data);
      if (parsed.data.source !== "motion" || parsed.data.label === "Uncertain") {
        setStatus("No clear movement sign matched. Nothing was added.");
      } else {
        setSuggestion(parsed.data);
        setStatus("Movement model suggestion ready. Review it before adding it.");
      }
    } catch (motionError) {
      if (activeRef.current && sessionRef.current === sessionId) {
        setError(motionError instanceof Error ? motionError.message : "Motion recognition failed.");
        setStatus("Movement capture failed.");
      }
    } finally {
      motionAbortRef.current = null;
      motionCaptureRef.current = false;
      if (mountedRef.current) {
        setRecognizingMotion(false);
        if (activeRef.current) void trackNextFrame();
      }
    }
  };

  const addSuggestion = () => {
    if (!suggestion) return;
    appendRecognizedSign(suggestion.label);
    setStatus(`Added ${suggestion.label.replaceAll("_", " ")} to the live transcript.`);
    setSuggestion(null);
  };

  const deleteLast = () => {
    setMessage((current) => current.slice(0, -1));
  };

  const clearMessage = () => {
    setMessage("");
    setSuggestion(null);
    setPrediction(null);
    candidateRef.current = null;
    acceptedRef.current = null;
    releaseFramesRef.current = 0;
    setStatus("Transcript cleared. Keep signing to begin again.");
  };

  const speakMessage = () => {
    const text = message.trim();
    if (!text || !("speechSynthesis" in window)) {
      setError(text ? "Speech playback is not supported in this browser." : "Sign a letter or enter text first.");
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(330px,0.85fr)]">
      <section className="flex min-w-0 flex-col gap-4" aria-label="Live ASL camera recognition">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", running ? "bg-mastered" : "bg-ink-faint")} aria-hidden />
            <span className="shrink-0 font-medium text-ink">{running ? "Live" : "Camera off"}</span>
            <span className="truncate text-ink-muted">{status}</span>
          </div>
          {!running ? (
            <Button onClick={() => void startCamera()} disabled={starting}>{starting ? "Starting…" : "Start live camera"}</Button>
          ) : (
            <button type="button" onClick={stopCamera} className={buttonStyles({ variant: "secondary", size: "md" })}>Stop camera</button>
          )}
        </div>

        {error && <div role="alert" className="rounded-lg border border-needswork-line bg-needswork-bg px-3 py-2 text-sm text-needswork-text">{error}</div>}
        {!health && running && (
          <div className="rounded-lg border border-developing-line bg-developing-bg px-3 py-2 text-sm text-ink-3">
            Camera preview only: start the hand-aware model service to transcribe signs.
          </div>
        )}

        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-[#17191d]">
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 block h-full w-full -scale-x-100 object-cover" aria-label="Mirrored live camera preview" />
          <canvas ref={landmarkCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100" aria-label="Detected hand landmark overlay" />
          {!running && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-white/80">
              <span className="text-4xl" aria-hidden>◎</span>
              <span className="text-sm">Start the camera to see live hand tracking</span>
            </div>
          )}
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
            {prediction?.handDetected ? "HAND TRACKED" : "WAITING FOR HAND"}
          </div>
          {prediction?.faceDetected && (
            <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-[#a8f3e6]">
              FACE TRACKED
            </div>
          )}
          {prediction?.handDetected && prediction.source === "static" && prediction.confidence !== null && (
            <div className="pointer-events-none absolute bottom-3 right-3 rounded-xl bg-black/75 px-4 py-2 text-white">
              <span className="block text-[0.625rem] uppercase tracking-widest text-white/65">Possible letter</span>
              <span className="text-3xl font-semibold">{prediction.label}</span>
              <span className="ml-2 text-xs text-white/70">{Math.round(prediction.confidence * 100)}%</span>
            </div>
          )}
          <canvas ref={captureCanvasRef} className="hidden" aria-hidden />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
          <span>Hold each fingerspelled letter steady; move your hand between repeated letters. Teal lines track facial landmarks.</span>
          {health && <span>Model: <strong className="font-medium text-ink">{modelDisplayName(health.model)}</strong></span>}
        </div>
        {prediction?.faceDetected && prediction.facialCues && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-surface-subtle px-3 py-2 text-xs text-ink-muted" aria-live="polite">
            <span className="font-medium text-ink">Experimental non-manual cues</span>
            <span>Mouth opening: {Math.round(prediction.facialCues.mouthOpen * 100)}%</span>
            <span>Brow/eye spacing: {prediction.facialCues.browEyeGap.toFixed(1)}×</span>
            <span>These are landmarks, not interpreted ASL grammar.</span>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5" aria-label="Supported ASL fingerspelling letters">
          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => (
            <span key={letter} className="rounded-md border border-line bg-surface-subtle px-2 py-1 text-xs font-medium text-ink-muted">{letter}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void captureMovement()} disabled={!running || recognizingMotion || !health?.motionReady}>
            {recognizingMotion ? "Analyzing movement…" : "Recognize movement"}
          </Button>
          {!health?.motionReady && (
            <span className="self-center text-xs text-ink-muted">Word-level movement translation needs a configured vision model.</span>
          )}
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface-subtle p-4 sm:p-5" aria-label="Live sign transcript">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="eyebrow">Live transcript</div>
            <h2 className="mb-0 mt-1 text-xl font-semibold text-ink">Recognized characters</h2>
          </div>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(message)}
            disabled={!message}
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            Copy
          </button>
        </div>

        <div aria-live="polite" aria-atomic="true" className="min-h-40 flex-1 rounded-xl border border-line bg-surface p-4 text-2xl leading-relaxed tracking-wide text-ink">
          {message || <span className="text-base tracking-normal text-ink-faint">Start signing. Confident, steady letters will appear here automatically.</span>}
        </div>

        {suggestion && prediction?.handDetected && prediction.confidence !== null && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-developing-line bg-developing-bg p-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-developing-text">Review lower-confidence sign</div>
              <div className="mt-1 text-xl font-semibold text-ink">{suggestion.label}</div>
              <div className="text-xs text-ink-muted">Model score {Math.round((suggestion.confidence ?? 0) * 100)}%; not auto-added.</div>
            </div>
            <Button onClick={addSuggestion}>Add letter</Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            <input type="checkbox" checked={speakOnCapture} onChange={(event) => {
              speakOnCaptureRef.current = event.target.checked;
              setSpeakOnCapture(event.target.checked);
            }} />
            Speak recognized letters
          </label>
        </div>

        {suggestion?.source === "motion" && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-mastered-line bg-mastered-bg p-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-mastered-text">Movement suggestion</div>
              <div className="mt-1 text-lg font-semibold text-ink">{suggestion.label.replaceAll("_", " ")}</div>
            </div>
            <Button onClick={addSuggestion}>Add sign</Button>
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-3">
          <Button onClick={speakMessage} disabled={!message.trim()}>Speak now</Button>
          <button type="button" onClick={() => setMessage((current) => `${current} `)} disabled={!message} className={buttonStyles({ variant: "secondary", size: "md" })}>Space</button>
          <button type="button" onClick={deleteLast} disabled={!message} className={buttonStyles({ variant: "secondary", size: "md" })}>Backspace</button>
          <button type="button" onClick={clearMessage} disabled={!message} className={buttonStyles({ variant: "secondary", size: "md" })}>Clear</button>
        </div>

        <p className="m-0 border-t border-line pt-3 text-xs leading-5 text-ink-muted">
          Live model: hand-tracked ASL alphabet fingerspelling (A–Z). Face landmarks and basic mouth/brow measurements run locally; they do not identify people or interpret facial grammar. Full ASL sentence translation needs a trained continuous-sign model.
        </p>
      </section>
    </div>
  );
}
