// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
const { api, streamTutor } = vi.hoisted(() => ({ api: { assess: vi.fn() }, streamTutor: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
vi.mock("@proveit/lib/api", () => ({ api }));
vi.mock("@proveit/lib/tutorStream", () => ({ streamTutor }));
// jsdom has no layout, so scrolling into view is a no-op here.
Element.prototype.scrollIntoView = vi.fn();

import { SessionChat } from "./SessionChat";
import type { QuestionView } from "@proveit/server/store";

const question: QuestionView = { courseName: "Intro Statistics", conceptId: "cii", conceptName: "CI interpretation", state: "needs_work", prompt: "Explain what a 95% confidence interval means.", why: "Why", probe: "Probe?", source: "Unit 03", sources: [] };
const OPENING = "Let's talk about CI interpretation. What do you think it means?";
const mountAuto = () => render(<SessionChat userId="u" courseId="intro-stats" question={question} opening={OPENING} autoTalk />);
const mount = (resume?: { attemptId: string; answer: string; followUp: string }) => render(<SessionChat userId="user_a" courseId="intro-stats" question={question} opening={OPENING} resume={resume} />);
/** A tutor that replies with the given texts, one per call, streaming each in two pieces. */
const tutor = (...replies: string[]) => replies.forEach((r) => streamTutor.mockImplementationOnce(async (_i: unknown, onText: (t: string) => void) => { onText(r.slice(0, 6)); onText(r); return r; }));
const type = (placeholder: RegExp | string, text: string) => userEvent.type(screen.getByPlaceholderText(placeholder), text);

beforeEach(() => { push.mockReset(); api.assess.mockReset(); streamTutor.mockReset(); sessionStorage.clear(); });
afterEach(cleanup);

describe("Test this concept, as a conversation", () => {
  it("opens with the tutor asking what the student thinks, and shows no graded question", () => {
    mount();
    expect(screen.getByText(OPENING)).toBeTruthy();
    expect(screen.queryByText(question.prompt)).toBeNull();
    expect(screen.queryByText(/Graded against|Why this question/)).toBeNull();
    expect(screen.getByPlaceholderText("Tell me what you think")).toBeTruthy();
    expect(screen.getByText("Just talking. Nothing here is graded.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Check what I/ })).toBeNull();
  });

  it("answers what they said, and sends the whole conversation after the opening each time", async () => {
    tutor("That's close. The 95 describes the method, not one interval. What happens if you repeat the study?", "Right. Then what is true of one interval already calculated?");
    mount();
    await type("Tell me what you think", "I think it means I'm 95% sure the mean is in my range");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(/That's close\. The 95 describes the method/)).toBeTruthy();
    expect(streamTutor.mock.calls[0]![0]).toMatchObject({ endpoint: "/api/session", fields: { conceptId: "cii" }, messages: [{ role: "user", text: "I think it means I'm 95% sure the mean is in my range" }] });
    await type("Reply to your tutor", "Most of the intervals catch the mean");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText(/Then what is true of one interval/);
    expect(streamTutor.mock.calls[1]![0].messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(api.assess).not.toHaveBeenCalled();
  });

  it("on I don't know yet, the tutor asks which part is confusing, as quick replies", async () => {
    tutor("Which part confuses you most?\nOPTIONS: The 95% part | What an interval is | Teach me from scratch");
    mount();
    await userEvent.click(screen.getByRole("button", { name: "I don't know yet" }));
    expect(await screen.findByText("Which part confuses you most?")).toBeTruthy();
    expect(streamTutor.mock.calls[0]![0].messages).toEqual([{ role: "user", text: "I don't know yet" }]);
    expect(screen.queryByText(/OPTIONS/)).toBeNull();
    const chips = within(screen.getByRole("group", { name: "Quick replies" }));
    expect(chips.getAllByRole("button").map((b) => b.textContent)).toEqual(["The 95% part", "What an interval is", "Teach me from scratch"]);
  });

  it("never shows quick replies that could be answers to the tutor's question", async () => {
    tutor("What does 95% refer to?\nOPTIONS: The method's long-run hit rate | The chance this interval is right");
    mount();
    await type("Tell me what you think", "an interval");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("What does 95% refer to?")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Quick replies" })).toBeNull();
  });

  it("sends a quick reply as the student's message, and it carries on from there", async () => {
    tutor("Which part confuses you most?\nOPTIONS: The 95% part | Teach me from scratch", "Okay, from the start. Imagine tossing rings at a peg. Is the peg moving?");
    mount();
    await userEvent.click(screen.getByRole("button", { name: "I don't know yet" }));
    await userEvent.click(await screen.findByRole("button", { name: "Teach me from scratch" }));
    expect(await screen.findByText(/Imagine tossing rings at a peg/)).toBeTruthy();
    expect(streamTutor.mock.calls[1]![0].messages.at(-1)).toEqual({ role: "user", text: "Teach me from scratch" });
    expect(screen.queryByRole("group", { name: "Quick replies" })).toBeNull();
  });

  it("only asks the graded question when they choose Check what I've got", async () => {
    tutor("Good start. Say more?");
    mount();
    await type("Tell me what you think", "The range holds the mean");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Good start. Say more?");
    await userEvent.click(screen.getByRole("button", { name: "Check what I've got" }));
    expect(screen.getByText(question.prompt)).toBeTruthy();
    expect(screen.getByText(/This one is graded/)).toBeTruthy();
    expect(screen.getByPlaceholderText("Explain it in your own words")).toBeTruthy();
    expect(screen.getByText("This answer is graded.")).toBeTruthy();
  });

  it("grades their answer and opens the diagnosis", async () => {
    tutor("Good start.");
    api.assess.mockResolvedValue({ attemptId: "a1", evaluation: { verdict: "incorrect" } });
    mount();
    await type("Tell me what you think", "A range");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Good start.");
    await userEvent.click(screen.getByRole("button", { name: "Check what I've got" }));
    await type("Explain it in your own words", "The 95 is about the method over many samples.");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(api.assess).toHaveBeenCalledWith(expect.objectContaining({ courseId: "intro-stats", conceptId: "cii", answer: "The 95 is about the method over many samples." })));
    expect(push).toHaveBeenCalledWith("/course/intro-stats/diagnosis/a1");
  });

  it("follows up inline when an answer is too thin, keeping the thread in order, and links the next answer to it", async () => {
    tutor("Good start.");
    api.assess.mockResolvedValueOnce({ attemptId: "a1", evaluation: { verdict: "uncertain", followUp: "Say what the 95 attaches to." } }).mockResolvedValueOnce({ attemptId: "a2", evaluation: { verdict: "correct" } });
    mount();
    await type("Tell me what you think", "A range");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Good start.");
    await userEvent.click(screen.getByRole("button", { name: "Check what I've got" }));
    await type("Explain it in your own words", "It is a range.");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("Say what the 95 attaches to.");
    const log = screen.getByRole("log").textContent ?? "";
    expect(log.indexOf("Good start.")).toBeLessThan(log.indexOf(question.prompt));
    expect(log.indexOf(question.prompt)).toBeLessThan(log.indexOf("It is a range."));
    expect(log.indexOf("It is a range.")).toBeLessThan(log.indexOf("Say what the 95 attaches to."));
    await type("Explain it in your own words", "It describes the method.");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(api.assess).toHaveBeenLastCalledWith(expect.objectContaining({ followUpTo: "a1" })));
  });

  it("lets them go back to talking after the check question appears", async () => {
    tutor("Good start.");
    mount();
    await type("Tell me what you think", "A range");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Good start.");
    await userEvent.click(screen.getByRole("button", { name: "Check what I've got" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep talking" }));
    expect(screen.getByPlaceholderText("Reply to your tutor")).toBeTruthy();
    expect(screen.getByText("Just talking. Nothing here is graded.")).toBeTruthy();
  });

  it("starts the check from the tutor's own suggestion, and ignores Keep talking", async () => {
    tutor("You've got it. Want me to check?\nOPTIONS: Check what I've got | Keep talking");
    mount();
    await type("Tell me what you think", "The 95 is about the method");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const chips = await screen.findByRole("group", { name: "Quick replies" });
    await userEvent.click(within(chips).getByRole("button", { name: "Keep talking" }));
    expect(screen.queryByRole("group", { name: "Quick replies" })).toBeNull();
    expect(streamTutor).toHaveBeenCalledTimes(1);
  });

  it("takes a failed turn back, shows why, and puts their words back in the box", async () => {
    streamTutor.mockRejectedValueOnce(new Error("OpenRouter is rate limited or out of quota. Retry in a moment."));
    mount();
    await type("Tell me what you think", "It is a range");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect((await screen.findByText(/rate limited/)).textContent).toContain("Retry in a moment");
    expect((screen.getByPlaceholderText("Tell me what you think") as HTMLTextAreaElement).value).toBe("It is a range");
    expect(screen.queryByText("It is a range", { selector: "div" })).toBeNull();
  });

  it("picks the conversation back up after a reload", async () => {
    tutor("Good start. Say more?");
    const first = mount();
    await type("Tell me what you think", "A range");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Good start. Say more?");
    first.unmount();
    mount();
    expect(await screen.findByText("Good start. Say more?")).toBeTruthy();
    expect(screen.getByText("A range")).toBeTruthy();
  });

  it("does not restore another account or a legacy unscoped transcript", async () => {
    const privateThread = JSON.stringify({ items: [{ id: 1, kind: "chat", role: "assistant", text: "Private learner answer" }], mode: "chat" });
    sessionStorage.setItem('proveit.session.v2:["user_b","intro-stats","cii"]', privateThread);
    sessionStorage.setItem("proveit.session.intro-stats.cii", privateThread);
    mount();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.queryByText("Private learner answer")).toBeNull();
    expect(screen.getByText(OPENING)).toBeTruthy();
  });

  it("resumes at the check when it was opened from a follow-up link", () => {
    mount({ attemptId: "a9", answer: "It is a range.", followUp: "Say what the 95 attaches to." });
    expect(screen.getByText("Say what the 95 attaches to.")).toBeTruthy();
    expect(screen.getByPlaceholderText("Explain it in your own words")).toBeTruthy();
  });
});


describe("answer by talk", () => {
  afterEach(() => { localStorage.clear(); delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition; });

  it("opens the live call when the student chose Talk and the browser can listen", async () => {
    localStorage.setItem("proveit.settings", JSON.stringify({ answerMode: "talk" }));
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = function Recognition() {};
    mountAuto();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/course/intro-stats/practice/cii/talk"));
  });

  it("stays in the chat when they chose Type", async () => {
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = function Recognition() {};
    replace.mockClear();
    mountAuto();
    await new Promise((r) => setTimeout(r, 20));
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("sign input", () => {
  it("opens the ASL Assistant panel from the composer and closes it", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Sign your message" }));
    expect(screen.getByLabelText("ASL Assistant panel")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Close ASL Assistant" }));
    expect(screen.queryByLabelText("ASL Assistant panel")).toBeNull();
  });

  it("hides the Sign button when it is switched off in Settings", async () => {
    localStorage.setItem("proveit.settings", JSON.stringify({ signInput: false }));
    mount();
    expect(screen.queryByRole("button", { name: "Sign your message" })).toBeNull();
    localStorage.clear();
  });
});
