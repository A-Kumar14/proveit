// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { SidebarFrame } from "./SidebarFrame";

afterEach(cleanup);
const mount = () => render(<SidebarFrame><nav aria-label="Sidebar"><a href="/history">History</a></nav></SidebarFrame>);

describe("SidebarFrame", () => {
  it("opens from the menu button and closes with Escape", async () => {
    mount();
    const button = screen.getByRole("button", { name: "Open menu" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Close menu" }).getAttribute("aria-expanded")).toBe("true");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy();
  });

  it("closes when a link inside is chosen", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await userEvent.click(screen.getByRole("link", { name: "History" }));
    expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy();
  });
});
