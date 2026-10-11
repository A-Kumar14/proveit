// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS } from "@proveit/lib/prefs";
import { SettingsPanel } from "./SettingsPanel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const mount = () => render(<SettingsPanel initialPrefs={DEFAULT_PREFS} courses={[{ id: "intro-stats", name: "Intro Statistics" }, { id: "pf", name: "Personal Finance" }]} />);
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (_u: string, init?: RequestInit) => new Response(JSON.stringify({ ...DEFAULT_PREFS, ...(init?.body ? JSON.parse(String(init.body)) : {}) }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("tutor and voice settings", () => {
  it("saves a tutor choice to the account and shows it at once", async () => {
    mount();
    await userEvent.click(screen.getByRole("tab", { name: "Tutor" }));
    await userEvent.click(screen.getByRole("button", { name: "Detailed" }));
    expect(screen.getByRole("button", { name: "Detailed" }).getAttribute("aria-pressed")).toBe("true");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ detail: "detailed" });
  });

  it("puts the old value back when saving fails", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("{}", { status: 500 }));
    mount();
    await userEvent.click(screen.getByRole("tab", { name: "Tutor" }));
    await userEvent.click(screen.getByRole("button", { name: "Detailed" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Brief" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("picks a tutor voice from the list", async () => {
    mount();
    await userEvent.click(screen.getByRole("tab", { name: "Voice" }));
    await userEvent.click(screen.getByRole("button", { name: /^Rachel/ }));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ tutorVoice: "21m00Tcm4TlvDq8ikWAM" });
  });
});

describe("data settings", () => {
  it("only starts a course over once its name is typed exactly", async () => {
    mount();
    await userEvent.click(screen.getByRole("tab", { name: "Data and privacy" }));
    const go = screen.getByRole("button", { name: "Start over" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText(/to confirm/), "Intro Stat");
    expect(go.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText(/to confirm/), "istics");
    expect(go.disabled).toBe(false);
  });

  it("clears saved tutor chats from this device and leaves everything else", async () => {
    sessionStorage.setItem('proveit.session.v2:["u","c","k"]', "x");
    sessionStorage.setItem("unrelated", "keep");
    mount();
    await userEvent.click(screen.getByRole("tab", { name: "Data and privacy" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear chats" }));
    expect(sessionStorage.getItem('proveit.session.v2:["u","c","k"]')).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("keep");
  });
});
