import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_PREFS } from "@proveit/lib/prefs";
import { addVoiceUsage, getPrefs, getVoiceUsage, setPrefs, voiceCapSeconds } from "./prefs";
import { sessionSystem } from "./session";
import { closePersistenceForTests, saveUserJson } from "./persistence";

const DB = join(tmpdir(), "proveit-prefs-test.sqlite");
const clear = () => { for (const suffix of ["", "-shm", "-wal"]) if (existsSync(DB + suffix)) rmSync(DB + suffix); };

beforeEach(() => { closePersistenceForTests(); clear(); process.env.PROVEIT_DB_PATH = DB; });
afterEach(() => { closePersistenceForTests(); clear(); delete process.env.PROVEIT_DB_PATH; delete process.env.VOICE_MINUTES_CAP; });

describe("prefs", () => {
  it("starts from the defaults", () => {
    expect(getPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("saves a partial change and keeps the rest", () => {
    setPrefs({ detail: "detailed" });
    setPrefs({ quizLength: 12 });
    expect(getPrefs()).toMatchObject({ detail: "detailed", quizLength: 12, approach: "questions" });
  });

  it("refuses values outside the allowed lists", () => {
    expect(() => setPrefs({ tutorVoice: "not-a-curated-voice" })).toThrow();
    expect(() => setPrefs({ quizLength: 99 })).toThrow();
    expect(getPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("falls back to defaults when what was stored is damaged", () => {
    saveUserJson("prefs", { detail: "huge", quizLength: "lots" });
    expect(getPrefs()).toEqual(DEFAULT_PREFS);
  });
});

describe("tutor style reaches the brief from the server", () => {
  it("adds the student's preferences, and only the fixed ones", () => {
    expect(sessionSystem("intro-stats", "cii")).not.toContain("The student's preferences");
    setPrefs({ detail: "detailed", approach: "direct", quickReplies: false });
    const brief = sessionSystem("intro-stats", "cii");
    expect(brief).toContain("The student's preferences");
    expect(brief).toContain("Up to 160 words");
    expect(brief).toContain("explain first");
    expect(brief).toContain("Never write an OPTIONS line");
  });
});

describe("voice usage", () => {
  it("adds up calls and counts a call at most 30 minutes", () => {
    addVoiceUsage(90);
    addVoiceUsage(99999);
    addVoiceUsage(-5);
    expect(getVoiceUsage()).toEqual({ seconds: 90 + 30 * 60, calls: 2 });
  });

  it("reads the per-account cap from the environment", () => {
    expect(voiceCapSeconds()).toBeNull();
    process.env.VOICE_MINUTES_CAP = "15";
    expect(voiceCapSeconds()).toBe(900);
    process.env.VOICE_MINUTES_CAP = "nope";
    expect(voiceCapSeconds()).toBeNull();
  });
});

describe("a patch only changes what it names", () => {
  it("rejects unknown keys", () => {
    expect(() => setPrefs({ isAdmin: true })).toThrow();
  });
});
