// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { push, replace } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => "/course/intro-stats/practice/se" }));
vi.mock("../signbridge/SignBridgeDemo", () => ({
  SignBridgeDemo: ({ onRecognizedText }: {
    onRecognizedText: (text: string, kind: "letter" | "sign", startsTranscript: boolean) => void;
  }) => <button type="button" onClick={() => onRecognizedText("A", "letter", true)}>Recognize letter</button>,
}));

import type { QuestionView } from "@proveit/server/store";
import { PracticeFlow } from "./PracticeFlow";

const question: QuestionView = {
  courseName: "Intro Statistics",
  conceptId: "se",
  conceptName: "Standard error",
  state: "not_started",
  prompt: "Which sample has the smaller standard error?",
  why: "Why",
  probe: "Probe?",
  source: "Unit 02",
  sources: [],
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("PracticeFlow ASL input", () => {
  it("adds recognized letters to the practice answer draft", async () => {
    const user = userEvent.setup();
    render(<PracticeFlow courseId="intro-stats" question={question} uploads={{ enabled: false }} />);

    await user.click(screen.getByRole("button", { name: "Open ASL Assistant" }));
    const panel = screen.getByLabelText("ASL Assistant panel");
    await user.click(within(panel).getByRole("button", { name: "Recognize letter" }));

    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveProperty("value", "A");
    expect(push).not.toHaveBeenCalled();
  });
});
