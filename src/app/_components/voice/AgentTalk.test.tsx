// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hook = vi.hoisted(() => ({ startSession: vi.fn(), endSession: vi.fn(), setMuted: vi.fn(), cb: {} as { onMessage?: (m: { message: string; source: "user" | "ai" }) => void }, status: "disconnected" }));
vi.mock("@elevenlabs/react", () => ({
  ConversationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useConversation: (cb: typeof hook.cb) => { hook.cb = cb; return { startSession: hook.startSession, endSession: hook.endSession, setMuted: hook.setMuted, status: hook.status, isMuted: false, isSpeaking: false }; },
}));

import { AgentTalk } from "./AgentTalk";
import { sessionStorageKey } from "@proveit/lib/sessionStorageKey";

const KEY = sessionStorageKey("u1", "intro-stats", "cii");
const mount = () => render(<AgentTalk userId="u1" courseId="intro-stats" conceptId="cii" chatHref="/chat" />);

beforeEach(() => {
  sessionStorage.clear();
  hook.startSession.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ conversationToken: "tok", prompt: "BRIEF", firstMessage: "Hello there" }), { status: 200 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("AgentTalk", () => {
  it("starts a call with the concept's brief as overrides and the chat so far sent along", async () => {
    sessionStorage.setItem(KEY, JSON.stringify({ items: [{ id: 1, kind: "chat", role: "assistant", text: "Hi" }, { id: 2, kind: "chat", role: "user", text: "I think it is 95% sure" }], mode: "chat" }));
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Start the call" }));
    const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1].body);
    expect(body.history).toEqual([{ role: "assistant", text: "Hi" }, { role: "user", text: "I think it is 95% sure" }]);
    expect(hook.startSession).toHaveBeenCalledWith({ conversationToken: "tok", connectionType: "webrtc", overrides: { agent: { prompt: { prompt: "BRIEF" }, firstMessage: "Hello there" } } });
  });

  it("saves what is said to the same thread as the chat, without repeating the opening", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Start the call" }));
    hook.cb.onMessage?.({ message: "Hello there", source: "ai" });
    hook.cb.onMessage?.({ message: "It's about repeated samples", source: "user" });
    hook.cb.onMessage?.({ message: "Good. Why 95?", source: "ai" });
    const saved = JSON.parse(sessionStorage.getItem(KEY)!);
    expect(saved.items.map((i: { role: string; text: string }) => `${i.role}: ${i.text}`)).toEqual(["user: It's about repeated samples", "assistant: Good. Why 95?"]);
  });

  it("shows the server's message when the call can't start", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "no key" }), { status: 501 })));
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Start the call" }));
    expect((await screen.findByRole("alert")).textContent).toBe("no key");
    expect(hook.startSession).not.toHaveBeenCalled();
  });
});
