// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectChunks, rangeFor, READING_EVENT, readChunks, stopReading, wordEnd } from "./readAloud";

/** A stand-in for the browser's speech engine: records utterances and lets a test fire their events. */
class FakeUtterance {
  rate = 1; lang = "";
  onboundary: ((e: { name: string; charIndex: number; charLength?: number }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}
const spoken: FakeUtterance[] = [];
const highlights = new Map<string, { ranges: Range[] }>();

beforeEach(() => {
  spoken.length = 0;
  highlights.clear();
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.stubGlobal("speechSynthesis", { speak: (u: FakeUtterance) => spoken.push(u), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() });
  vi.stubGlobal("Highlight", class { ranges: Range[]; constructor(...r: Range[]) { this.ranges = r; } });
  vi.stubGlobal("CSS", { highlights });
  Range.prototype.getBoundingClientRect = () => ({ top: 10, bottom: 20, height: 10, left: 0, right: 0, width: 0, x: 0, y: 10, toJSON: () => ({}) });
});
afterEach(() => {
  stopReading();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const mount = (html: string) => {
  document.body.innerHTML = `<div class="a11y-app"><main>${html}</main></div>`;
  return document.querySelector("main")!;
};

describe("collectChunks", () => {
  it("makes one chunk per block, joins inline text, and skips hidden and decorative content", () => {
    const main = mount(`<h1>Standard error</h1><p>Shrinks as <b>n</b> grows.</p><p aria-hidden="true">duplicate</p><div data-read-aloud-skip>controls</div><script>x()</script>`);
    expect(collectChunks(main).map((c) => c.text)).toEqual(["Standard error", "Shrinks as n grows."]);
  });

  it("reads only the selected part of a text node", () => {
    const main = mount(`<p>Population versus sample</p>`);
    const text = main.querySelector("p")!.firstChild!;
    const r = document.createRange();
    r.setStart(text, 11);
    r.setEnd(text, 24);
    expect(collectChunks(r.commonAncestorContainer, r).map((c) => c.text)).toEqual(["versus sample"]);
  });
});

describe("rangeFor", () => {
  it("maps a spoken word back to the page, across inline elements", () => {
    const main = mount(`<p>The <em>standard</em> err<i>or</i> shrinks</p>`);
    const [chunk] = collectChunks(main);
    expect(chunk.text).toBe("The standard error shrinks");
    expect(rangeFor(chunk, 4, 12)!.toString()).toBe("standard");
    expect(rangeFor(chunk, 13, 18)!.toString()).toBe("error");
    expect(rangeFor(chunk, 19, 26)!.toString()).toBe("shrinks");
    expect(rangeFor(chunk, 30, 34)).toBeNull();
  });

  it("finds the end of a word when the engine gives no length", () => {
    expect(wordEnd("The standard error", 4)).toBe(12);
    expect(wordEnd("The standard error", 4, 8)).toBe(12);
    expect(wordEnd("end", 3)).toBe(3);
  });
});

describe("readChunks", () => {
  it("speaks each block in turn, highlights each word, and reports where it is", () => {
    const main = mount(`<p>First block</p><p>Second <b>one</b></p>`);
    const ys: number[] = [];
    const onReading = (e: Event) => ys.push((e as CustomEvent<{ y: number }>).detail.y);
    window.addEventListener(READING_EVENT, onReading);
    expect(readChunks(collectChunks(main), 1.25)).toBe(true);
    expect(spoken.map((u) => u.text)).toEqual(["First block"]);
    expect(spoken[0].rate).toBe(1.25);

    spoken[0].onboundary!({ name: "word", charIndex: 6, charLength: 5 });
    expect(highlights.get("read-aloud-word")!.ranges[0].toString()).toBe("block");
    expect(ys).toEqual([15]);

    spoken[0].onend!();
    expect(spoken.map((u) => u.text)).toEqual(["First block", "Second one"]);
    spoken[1].onboundary!({ name: "word", charIndex: 7 });
    expect(highlights.get("read-aloud-word")!.ranges[0].toString()).toBe("one");

    spoken[1].onend!();
    expect(highlights.has("read-aloud-word")).toBe(false);
    window.removeEventListener(READING_EVENT, onReading);
  });

  it("ignores events from an utterance it already stopped", () => {
    const main = mount(`<p>Old text</p>`);
    readChunks(collectChunks(main));
    const old = spoken[0];
    stopReading();
    old.onboundary!({ name: "word", charIndex: 0, charLength: 3 });
    old.onerror!({ error: "interrupted" });
    expect(highlights.size).toBe(0);
    expect(spoken).toHaveLength(1);
  });

  it("says so when there is nothing to read", () => {
    expect(readChunks([])).toBe(false);
  });
});
