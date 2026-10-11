// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignInput } from "./SignInput";

const letter = (label: string, confidence = 0.9) => ({ label, confidence, source: "static", handDetected: true, landmarks: null });
const noHand = { label: "none", confidence: null, source: "none", handDetected: false, landmarks: null };

let predictions: unknown[];
let fetchMock: ReturnType<typeof vi.fn>;
const stop = vi.fn();

beforeEach(() => {
  predictions = [];
  fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes("/health")) return new Response(JSON.stringify({ status: "ok", ready: true, model: "SignBridge Hand Landmark MLP" }), { status: 200 });
    if (String(url).includes("/predict")) return new Response(JSON.stringify(predictions.shift() ?? noHand), { status: 200 });
    return new Response("{}", { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) } });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 640 });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 480 });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn(), clearRect: vi.fn() })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = () => "data:image/jpeg;base64,AAAA";
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const flush = async (ms: number) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };

describe("SignInput", () => {
  it("says how to start the service when it isn't running, and keeps the camera off", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 503 }));
    render(<SignInput onUse={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText("ASL Assistant panel")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Start camera" }));
    expect((await screen.findByRole("alert")).textContent).toContain("examples/signbridge/service.py");
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it("adds a letter once it holds steady, then hands the word to the message box", async () => {
    predictions = [letter("H"), letter("H"), letter("H"), letter("H"), noHand, noHand, noHand, letter("I"), letter("I"), letter("I"), letter("I")];
    const onUse = vi.fn();
    render(<SignInput onUse={onUse} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Start camera" }));
    await flush(220 * 12 + 300);
    expect(screen.getByLabelText("Letters so far").textContent).toBe("HI");
    await userEvent.click(screen.getByRole("button", { name: "Use this" }));
    expect(onUse).toHaveBeenCalledWith("HI");
    expect(screen.getByLabelText("Letters so far").textContent).not.toContain("HI");
  }, 10000);

  it("doesn't add the same letter twice while the hand stays still", async () => {
    predictions = Array.from({ length: 10 }, () => letter("A"));
    render(<SignInput onUse={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Start camera" }));
    await flush(220 * 11 + 300);
    expect(screen.getByLabelText("Letters so far").textContent).toBe("A");
  }, 10000);

  it("stops the camera when closed", async () => {
    const onClose = vi.fn();
    render(<SignInput onUse={vi.fn()} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Start camera" }));
    await flush(50);
    await userEvent.click(screen.getByRole("button", { name: "Close ASL Assistant" }));
    expect(stop).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
