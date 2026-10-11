import { describe, expect, it } from "vitest";
import { forSpeech } from "./speechText";

describe("forSpeech", () => {
  it("drops the quick-reply line and markdown", () => {
    expect(forSpeech("**Nice.** The `mean` is *fixed*.\n- one\n- two\nOPTIONS: a | b")).toBe("Nice. The mean is fixed. one two");
  });
  it("keeps link text and drops code blocks", () => {
    expect(forSpeech("See [the notes](http://x.y). ```\ncode\n``` Done")).toBe("See the notes. Done");
  });
});
