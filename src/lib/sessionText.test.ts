import { describe, expect, it } from "vitest";
import { splitOptions } from "./sessionText";

describe("splitOptions", () => {
  it("separates the quick replies from the message", () => {
    expect(splitOptions("Which part is hardest?\nOPTIONS: The 95% part | What interval means | Teach me from scratch"))
      .toEqual({ text: "Which part is hardest?", options: ["The 95% part", "What interval means", "Teach me from scratch"] });
  });

  it("returns the text alone when there are none", () => {
    expect(splitOptions("Just a reply.")).toEqual({ text: "Just a reply.", options: [] });
  });

  it("keeps at most three, drops empty or very long ones, and strips markdown marks", () => {
    const r = splitOptions(`Pick one.\nOPTIONS: **One** | | ${"x".repeat(60)} | Two | Three | Four`);
    expect(r.options).toEqual(["One", "Two", "Three"]);
  });

  it("hides a marker that has only half arrived, so it never flashes on screen", () => {
    expect(splitOptions("Which part?\nOPT").text).toBe("Which part?");
    expect(splitOptions("Which part?\nOPTIONS").text).toBe("Which part?");
    expect(splitOptions("Which part?\nOPTIONS: Ones | Tw")).toMatchObject({ text: "Which part?", options: ["Ones", "Tw"] });
  });

  it("doesn't cut an ordinary message that happens to end in a capital O", () => {
    expect(splitOptions("What does the O").text).toBe("What does the O");
  });
});
