// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInput } from "./SignInput";

vi.mock("./SignBridgeDemo", () => ({
  SignBridgeDemo: ({ compact, autoStart, onRecognizedText }: {
    compact: boolean;
    autoStart: boolean;
    onRecognizedText: (text: string, kind: "letter" | "sign", startsTranscript: boolean) => void;
  }) => (
    <div data-testid="recognition-demo" data-compact={compact} data-auto-start={autoStart}>
      <button type="button" onClick={() => onRecognizedText("A", "letter", true)}>Recognize letter</button>
      <button type="button" onClick={() => onRecognizedText("HELLO_WORLD", "sign", true)}>Accept movement sign</button>
    </div>
  ),
}));

afterEach(cleanup);

describe("SignInput", () => {
  it("opens the compact live-recognition panel and streams accepted text to the draft", async () => {
    const user = userEvent.setup();
    const onRecognizedText = vi.fn();
    render(<SignInput onRecognizedText={onRecognizedText} onClose={vi.fn()} />);

    expect(screen.getByLabelText("ASL Assistant panel")).toBeTruthy();
    expect(screen.getByTestId("recognition-demo").getAttribute("data-compact")).toBe("true");
    expect(screen.getByTestId("recognition-demo").getAttribute("data-auto-start")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Recognize letter" }));
    await user.click(screen.getByRole("button", { name: "Accept movement sign" }));
    expect(onRecognizedText).toHaveBeenNthCalledWith(1, "A", "letter", true);
    expect(onRecognizedText).toHaveBeenNthCalledWith(2, "HELLO_WORLD", "sign", true);
  });

  it("closes from its button or Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<SignInput onRecognizedText={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Close ASL Assistant" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<SignInput onRecognizedText={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
