"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../Button";

/** Live preview from the device camera. "Capture" grabs one frame and sends it through the upload check. */
export function CameraCapture({ onShow, busy }: { onShow: (file: File) => void; busy: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" } }).then((s) => {
      if (cancelled) return s.getTracks().forEach((t) => t.stop());
      stream = s;
      if (video.current) { video.current.srcObject = s; setReady(true); }
    }).catch(() => { if (!cancelled) setError("Camera access is blocked. Allow it in your browser, or use Add file."); });
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob((b) => b && onShow(new File([b], "camera.jpg", { type: "image/jpeg" })), "image/jpeg", 0.85);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative flex h-[280px] items-center justify-center overflow-hidden rounded-sm border border-line bg-surface-subtle">
        {error ? <p role="alert" className="m-0 max-w-xs px-4 text-center text-[13px] text-needswork-text">{error}</p> : <video ref={video} autoPlay playsInline muted className="size-full object-cover" />}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-muted">Point it at your paper. Keep the page in frame.</span>
        <Button size="sm" onClick={capture} disabled={busy || !ready || !!error}>{busy ? "Checking..." : "Capture"}</Button>
      </div>
    </div>
  );
}
