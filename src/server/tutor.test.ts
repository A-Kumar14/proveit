import { describe, expect, it } from "vitest";
import { parseTutorForm, tutorSystem } from "./tutor";

const form = (over: Record<string, string | File | File[]> = {}) => {
  const f = new FormData();
  const base: Record<string, string | File | File[]> = { courseId: "intro-stats", messages: JSON.stringify([{ role: "user", text: "Hi" }]), ...over };
  for (const [k, v] of Object.entries(base)) (Array.isArray(v) ? v : [v]).forEach((x) => f.append(k, x));
  return f;
};
const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });

describe("parseTutorForm", () => {
  it("accepts a message with allowed files", () => {
    const r = parseTutorForm(form({ files: [file("a.png", "image/png"), file("b.pdf", "application/pdf")] }));
    expect("error" in r).toBe(false);
    expect(r).toMatchObject({ courseId: "intro-stats", messages: [{ role: "user", text: "Hi" }] });
    expect(!("error" in r) && r.files).toHaveLength(2);
  });

  it.each([
    ["no course", { courseId: "" }, /course/i],
    ["bad json", { messages: "{" }, /message/i],
    ["empty list", { messages: "[]" }, /.+/],
    ["last turn is the tutor's", { messages: JSON.stringify([{ role: "assistant", text: "Hi" }]) }, /yours/],
    ["unsupported type", { files: file("a.exe", "application/x-msdownload") }, /isn't supported/],
    ["too many files", { files: [1, 2, 3, 4].map((i) => file(`${i}.png`, "image/png")) }, /up to 3/],
    ["a file over 10 MB", { files: file("big.pdf", "application/pdf", 10 * 1024 * 1024 + 1) }, /over 10 MB/],
  ])("rejects %s", (_n, over, msg) => {
    const r = parseTutorForm(form(over as never));
    expect("error" in r && r.error).toMatch(msg);
  });
});

describe("tutorSystem", () => {
  it("carries the course context and the no-mastery rule, from the server", () => {
    const s = tutorSystem("intro-stats");
    expect(s).toContain("Intro Statistics");
    expect(s).toContain("CI interpretation");
    expect(s).toMatch(/Never claim to change the student's mastery/);
  });
});
