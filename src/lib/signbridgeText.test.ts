import { describe, expect, it } from "vitest";
import { appendRecognizedSignText } from "./signbridgeText";

describe("appendRecognizedSignText", () => {
  it("inserts a space before a new fingerspelled sequence, then joins its letters", () => {
    const first = appendRecognizedSignText("Answer", "H", "letter", true);
    expect(appendRecognizedSignText(first, "I", "letter", false)).toBe("Answer HI");
  });

  it("adds accepted movement signs as spaced words", () => {
    expect(appendRecognizedSignText("I ", "HELLO_WORLD", "sign", true)).toBe("I HELLO WORLD ");
  });

  it("starts cleanly when the draft already ends in whitespace", () => {
    expect(appendRecognizedSignText("Answer ", "A", "letter", true)).toBe("Answer A");
  });
});
