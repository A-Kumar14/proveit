// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
const { api, streamTutor } = vi.hoisted(() => ({ api: { assess: vi.fn(), checkUpload: vi.fn() }, streamTutor: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => "/course/intro-stats/practice/cii" }));
vi.mock("@proveit/lib/api", () => ({ api }));
vi.mock("@proveit/lib/tutorStream", () => ({ streamTutor }));

import { PracticeFlow } from "./PracticeFlow";
import type { QuestionView } from "@proveit/server/store";

const question: QuestionView = { courseName: "Intro Statistics", conceptId: "cii", conceptName: "CI interpretation", state: "needs_work", prompt: "Explain what a 95% confidence interval means.", why: "Why", probe: "Start smaller. What does the 95 describe, the method or this one interval?", source: "Unit 03" };
const flow = (guide: boolean) => render(<PracticeFlow courseId="intro-stats" question={question} uploads={{ enabled: false }} guide={guide} />);
/** A tutor that replies with the given texts, one per call, streaming each in two pieces. */
const tutor = (...replies: string[]) => replies.forEach((r) => streamTutor.mockImplementationOnce(async (_i: unknown, onText: (t: string) => void) => { onText(r.slice(0, 5)); onText(r); return r; }));

beforeEach(() => { push.mockReset(); replace.mockReset(); api.assess.mockReset(); streamTutor.mockReset(); localStorage.clear(); });
afterEach(cleanup);

describe("PracticeFlow, when the student doesn't know yet", () => {
  it("opens a guided chat, and the tutor's first step answers what they said", async () => {
    tutor("What do you already know about confidence intervals?");
    flow(true);
    await userEvent.click(screen.getByRole("button", { name: "I don't know yet" }));
    expect(await screen.findByText("What do you already know about confidence intervals?")).toBeTruthy();
    const call = streamTutor.mock.calls[0]![0];
    expect(call).toMatchObject({ courseId: "intro-stats", endpoint: "/api/guide", fields: { conceptId: "cii" }, messages: [{ role: "user", text: "I don't know yet" }] });
    expect(screen.queryByText(/I need one more answer/)).toBeNull();
    expect(screen.queryByText(question.probe)).toBeNull();
    expect(api.assess).not.toHaveBeenCalled();
  });

  it("keeps chatting without grading, sending the whole conversation each time", async () => {
    tutor("What do you already know?", "Right. So is the 95 about this one interval?");
    flow(true);
    await userEvent.click(screen.getByRole("button", { name: "I don't know yet" }));
    await screen.findByText("What do you already know?");
    expect(screen.getByText("Chatting with your tutor. Nothing here is graded.")).toBeTruthy();
    await userEvent.type(screen.getByPlaceholderText("Reply to your tutor"), "That it tells me how sure I am");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Right. So is the 95 about this one interval?")).toBeTruthy();
    expect(streamTutor.mock.calls[1]![0].messages).toEqual([
      { role: "user", text: "I don't know yet" }, { role: "assistant", text: "What do you already know?" }, { role: "user", text: "That it tells me how sure I am" },
    ]);
    expect(api.assess).not.toHaveBeenCalled();
  });

  it("goes back to answering when they say they're ready, and then grades their answer", async () => {
    tutor("What do you already know?");
    api.assess.mockResolvedValue({ attemptId: "a1", evaluation: { verdict: "incorrect" } });
    flow(true);
    await userEvent.click(screen.getByRole("button", { name: "I don't know yet" }));
    await screen.findByText("What do you already know?");
    await userEvent.click(screen.getByRole("button", { name: "I'm ready to answer" }));
    expect(screen.queryByPlaceholderText("Reply to your tutor")).toBeNull();
    await userEvent.type(screen.getByPlaceholderText(/in your own words|next answer/i), "The 95 is about the method over many samples.");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(api.assess).toHaveBeenCalledWith(expect.objectContaining({ conceptId: "cii", answer: "The 95 is about the method over many samples." })));
    expect(push).toHaveBeenCalledWith("/course/intro-stats/diagnosis/a1");
  });

  it("keeps the order of the thread when an answer needs a follow-up after some guiding", async () => {
    tutor("What do you already know?");
    api.assess.mockResolvedValue({ attemptId: "a1", evaluation: { verdict: "uncertain", followUp: "Say what the 95 attaches to." } });
    flow(true);
    await userEvent.click(screen.getByRole("button", { name: "I don't know yet" }));
    await screen.findByText("What do you already know?");
    await userEvent.click(screen.getByRole("button", { name: "I'm ready to answer" }));
    await userEvent.type(screen.getByPlaceholderText(/in your own words|next answer/i), "It is a range.");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("Say what the 95 attaches to.");
    const log = screen.getByRole("log").textContent ?? "";
    expect(log.indexOf("What do you already know?")).toBeLessThan(log.indexOf("It is a range."));
    expect(log.indexOf("It is a range.")).toBeLessThan(log.indexOf("Say what the 95 attaches to."));
  });

  it("takes a failed step back, shows why, and lets them try again", async () => {
    streamTutor.mockRejectedValueOnce(new Error("OpenRouter is rate limited or out of quota. Retry in a moment."));
    flow(true);
    await userEvent.click(screen.getByRole("button", { name: "I don't know yet" }));
    expect((await screen.findByText(/rate limited/)).textContent).toContain("Retry in a moment");
    expect(screen.queryByText("I don't know yet", { selector: "div" })).toBeNull();
  });

  it("without a model, falls back to the single smaller question", async () => {
    flow(false);
    await userEvent.click(screen.getByRole("button", { name: "I don't know yet" }));
    expect(await screen.findByText(question.probe)).toBeTruthy();
    expect(streamTutor).not.toHaveBeenCalled();
  });
});
