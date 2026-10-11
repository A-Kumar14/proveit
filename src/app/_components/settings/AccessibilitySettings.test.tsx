// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AccessibilityLayer } from "../a11y/AccessibilityLayer";
import { DEFAULT_PREFS } from "@proveit/lib/prefs";
import { SettingsPanel } from "./SettingsPanel";

const html = document.documentElement;
afterEach(() => {
  cleanup();
  localStorage.clear();
  for (const a of [...html.attributes]) if (a.name.startsWith("data-a11y")) html.removeAttribute(a.name);
});

const open = async () => {
  render(<><SettingsPanel initialPrefs={DEFAULT_PREFS} courses={[]} /><AccessibilityLayer /></>);
  await userEvent.click(screen.getByRole("tab", { name: "Accessibility Features" }));
};

describe("Accessibility Features settings", () => {
  it("holds dyslexia, vision and the read-questions-aloud setting", async () => {
    await open();
    expect(screen.getByRole("heading", { name: "Dyslexia support" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Vision support" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Read questions aloud" })).toBeTruthy();
  });

  it("applies each change to the whole page straight away, and saves it", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "OpenDyslexic" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Wider" })[0]);
    await userEvent.click(screen.getByRole("group", { name: "Zoom" }).querySelector("button:last-child")!);
    expect(html.dataset).toMatchObject({ a11yFont: "opendyslexic", a11yLetter: "wider", a11yZoom: "150" });
    expect(JSON.parse(localStorage.getItem("proveit.settings")!)).toMatchObject({ readingFont: "opendyslexic", letterSpacing: "wider", zoom: 150 });
  });

  it("shows line focus when it is switched on, and resets everything at once", async () => {
    await open();
    await userEvent.click(screen.getByRole("switch", { name: "Line focus" }));
    expect(document.querySelector(".line-focus")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Lexend" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(document.querySelector(".line-focus")).toBeNull();
    expect(html.dataset.a11yFont).toBeUndefined();
    expect((screen.getByRole("button", { name: "Reset to defaults" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
