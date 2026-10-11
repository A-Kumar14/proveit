// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { A11Y_DEFAULTS, a11yBootScript, applyA11y, sanitizeA11y, SETTINGS_KEY } from "./a11y";

const html = document.documentElement;
afterEach(() => {
  for (const a of [...html.attributes]) if (a.name.startsWith("data-a11y")) html.removeAttribute(a.name);
  html.removeAttribute("style");
  localStorage.clear();
});

describe("sanitizeA11y", () => {
  it("keeps valid values and replaces anything unknown with the default", () => {
    expect(sanitizeA11y({})).toEqual(A11Y_DEFAULTS);
    const s = sanitizeA11y({ readingFont: "lexend", letterSpacing: "wider", textSize: 130, zoom: 125, lineFocus: true, readAloudRate: 1.25 });
    expect(s).toMatchObject({ readingFont: "lexend", letterSpacing: "wider", textSize: 130, zoom: 125, lineFocus: true, readAloudRate: 1.25 });
    const bad = sanitizeA11y({ readingFont: "comic-sans", textSize: 400, zoom: "125", lineFocus: "yes", readAloudRate: 9 });
    expect(bad).toMatchObject({ readingFont: "default", textSize: 100, zoom: 100, lineFocus: false, readAloudRate: 1 });
  });
});

describe("applyA11y", () => {
  it("writes attributes and variables on <html>, and removes them at the defaults", () => {
    applyA11y(html, { readingFont: "opendyslexic", letterSpacing: "wide", wordSpacing: "wider", lineSpacing: "loose", textSize: 150, zoom: 110 });
    expect(html.dataset).toMatchObject({ a11yFont: "opendyslexic", a11yLetter: "wide", a11yWord: "wider", a11yLine: "loose", a11yZoom: "110" });
    expect(html.style.getPropertyValue("--a11y-text")).toBe("1.5");
    expect(html.style.getPropertyValue("--a11y-zoom")).toBe("1.1");
    applyA11y(html, A11Y_DEFAULTS);
    expect([...html.attributes].filter((a) => a.name.startsWith("data-a11y"))).toEqual([]);
    expect(html.style.getPropertyValue("--a11y-text")).toBe("1");
  });

  it("ignores values it doesn't know, so a hand-edited setting can't inject CSS", () => {
    applyA11y(html, { readingFont: "x; color: red", zoom: "1000", textSize: "calc(9)" });
    expect(html.dataset.a11yFont).toBeUndefined();
    expect(html.style.getPropertyValue("--a11y-zoom")).toBe("1");
    expect(html.style.getPropertyValue("--a11y-text")).toBe("1");
  });
});

describe("a11yBootScript", () => {
  it("applies saved settings on its own, and survives a corrupt entry", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ readingFont: "atkinson", zoom: 150 }));
    new Function(a11yBootScript(SETTINGS_KEY))();
    expect(html.dataset.a11yFont).toBe("atkinson");
    expect(html.style.getPropertyValue("--a11y-zoom")).toBe("1.5");
    localStorage.setItem(SETTINGS_KEY, "{not json");
    expect(() => new Function(a11yBootScript(SETTINGS_KEY))()).not.toThrow();
  });
});
