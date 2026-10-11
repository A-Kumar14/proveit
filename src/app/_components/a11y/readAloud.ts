"use client";

import { useSyncExternalStore } from "react";

/**
 * Read aloud with word-by-word highlighting. The browser's speech engine reports a boundary event per word;
 * each one is mapped back to the text node it came from and painted with the CSS Custom Highlight API,
 * which needs no changes to the page's DOM. One reader exists per tab.
 */

/** One text node's slice `[from, to)`, placed at `at` in its chunk's text. */
type Piece = { node: Text; from: number; to: number; at: number };
export type Chunk = { text: string; pieces: Piece[] };
export type ReadState = "idle" | "playing" | "paused";

const HIGHLIGHT = "read-aloud-word";
/** Never read: hidden content, decoration, and the read-aloud controls themselves. */
const SKIP = "script,style,noscript,template,svg,[hidden],[aria-hidden='true'],[data-read-aloud-skip]";
const INLINE = new Set(["inline", "inline-block", "inline-flex", "inline-grid", "contents"]);
/** Shorter utterances keep Chrome's network voices from cutting out mid-page. */
const MAX_CHUNK = 1_200;

const visible = (el: Element) => !el.closest(SKIP) && (typeof el.checkVisibility !== "function" || el.checkVisibility({ visibilityProperty: true }));

/** The nearest block-level ancestor. Each block becomes its own utterance, which gives a natural pause between them. */
function blockOf(el: Element): Element {
  let e = el;
  while (e.parentElement && INLINE.has(getComputedStyle(e).display)) e = e.parentElement;
  return e;
}

/** Splits the visible text under `root` (or inside `range`) into chunks, remembering where each character came from. */
export function collectChunks(root: Node, range?: Range | null): Chunk[] {
  const start = root.nodeType === Node.TEXT_NODE ? root.parentNode ?? root : root;
  const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT);
  const chunks: Chunk[] = [];
  let current: Chunk | null = null;
  let currentBlock: Element | null = null;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const parent = n.parentElement;
    if (!parent || !visible(parent)) continue;
    let from = 0, to = n.data.length;
    if (range) {
      if (!range.intersectsNode(n)) continue;
      if (n === range.startContainer) from = range.startOffset;
      if (n === range.endContainer) to = range.endOffset;
    }
    if (!n.data.slice(from, to).trim()) continue;
    const block = blockOf(parent);
    if (!current || block !== currentBlock || current.text.length > MAX_CHUNK) {
      current = { text: "", pieces: [] };
      chunks.push(current);
      currentBlock = block;
    }
    current.pieces.push({ node: n, from, to, at: current.text.length });
    current.text += n.data.slice(from, to);
  }
  return chunks;
}

/** The DOM range for characters `[start, end)` of a chunk, or null if they fall outside it. */
export function rangeFor(chunk: Chunk, start: number, end: number): Range | null {
  const locate = (i: number, isEnd: boolean) => {
    const p = chunk.pieces.find((x) => (isEnd ? i > x.at && i <= x.at + (x.to - x.from) : i >= x.at && i < x.at + (x.to - x.from)));
    return p ? { node: p.node, offset: p.from + (i - p.at) } : null;
  };
  const a = locate(start, false), b = locate(end, true);
  if (!a || !b) return null;
  const r = document.createRange();
  r.setStart(a.node, a.offset);
  r.setEnd(b.node, b.offset);
  return r;
}

/** Engines without charLength (Safari) still give charIndex, so the word runs to the next space. */
export function wordEnd(text: string, index: number, length?: number): number {
  if (length && length > 0) return index + length;
  const m = /^\S+/.exec(text.slice(index));
  return index + (m ? m[0].length : 0);
}

// ---- the reader ----

let state: ReadState = "idle";
let token = 0;
const listeners = new Set<() => void>();
const setState = (s: ReadState) => { state = s; listeners.forEach((l) => l()); };
const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;
const clearHighlight = () => { if (typeof CSS !== "undefined" && "highlights" in CSS) CSS.highlights.delete(HIGHLIGHT); };

/** Line focus listens for this to follow the spoken word. */
export const READING_EVENT = "proveit:reading";

function show(range: Range) {
  if (typeof CSS !== "undefined" && "highlights" in CSS) CSS.highlights.set(HIGHLIGHT, new Highlight(range));
  const rect = range.getBoundingClientRect();
  if (rect.top < 0 || rect.bottom > window.innerHeight) {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    range.startContainer.parentElement?.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
  }
  const after = range.getBoundingClientRect();
  window.dispatchEvent(new CustomEvent(READING_EVENT, { detail: { y: after.top + after.height / 2 } }));
}

export function stopReading() {
  token++;
  if (supported()) { speechSynthesis.resume(); speechSynthesis.cancel(); }
  clearHighlight();
  if (state !== "idle") setState("idle");
}

/** Reads the chunks in order. Returns false when there is nothing to read or no speech engine. */
export function readChunks(chunks: Chunk[], rate = 1): boolean {
  stopReading();
  if (!supported() || chunks.length === 0) return false;
  const mine = token;
  let i = 0;
  const next = () => {
    if (mine !== token) return;
    if (i >= chunks.length) { clearHighlight(); setState("idle"); return; }
    const chunk = chunks[i++];
    const u = new SpeechSynthesisUtterance(chunk.text);
    u.rate = rate;
    u.lang = document.documentElement.lang || "en";
    u.onboundary = (e) => {
      if (mine !== token || (e.name && e.name !== "word")) return;
      const r = rangeFor(chunk, e.charIndex, wordEnd(chunk.text, e.charIndex, e.charLength));
      if (r) show(r);
    };
    u.onend = next;
    // cancel() fires "interrupted" or "canceled" for the utterance it stopped; anything else moves on.
    u.onerror = (e) => { if (e.error !== "interrupted" && e.error !== "canceled") next(); };
    speechSynthesis.speak(u);
  };
  setState("playing");
  next();
  return true;
}

/** The current selection inside the app, if there is one worth reading. */
export function selectedRange(): Range | null {
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !sel.toString().trim()) return null;
  const r = sel.getRangeAt(0);
  return document.querySelector(".a11y-app")?.contains(r.commonAncestorContainer) ? r : null;
}

/** Reads the selection if there is one, otherwise the page's main content. */
export function readPageOrSelection(rate = 1): boolean {
  const range = selectedRange();
  if (range) return readChunks(collectChunks(range.commonAncestorContainer, range), rate);
  const root = document.querySelector(".a11y-app main") ?? document.querySelector(".a11y-app");
  return root ? readChunks(collectChunks(root), rate) : false;
}

export function pauseReading() {
  if (state !== "playing" || !supported()) return;
  speechSynthesis.pause();
  setState("paused");
}

export function resumeReading() {
  if (state !== "paused" || !supported()) return;
  speechSynthesis.resume();
  setState("playing");
}

export const useReadState = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => state, () => "idle" as const);
export const useReadAloudSupport = () => useSyncExternalStore(() => () => {}, supported, () => false);
