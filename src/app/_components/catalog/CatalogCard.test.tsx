// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const addCatalogCourse = vi.fn();
const removeCatalogCourse = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@proveit/lib/api", () => ({ api: { addCatalogCourse: (...a: unknown[]) => addCatalogCourse(...a), removeCatalogCourse: (...a: unknown[]) => removeCatalogCourse(...a) } }));

import { CatalogCard } from "./CatalogCard";

const item = { id: "chinese-101", name: "Chinese 101", topic: "Language", level: "Beginner", summary: "Mandarin basics.", units: 3, concepts: 9, added: false };
beforeEach(() => { refresh.mockReset(); addCatalogCourse.mockReset(); removeCatalogCourse.mockReset(); });
afterEach(cleanup);

describe("CatalogCard", () => {
  it("adds the course with the plus button and refreshes the page", async () => {
    addCatalogCourse.mockResolvedValue({ id: "chinese-101", added: true });
    render(<CatalogCard item={item} />);
    expect(screen.getByText("9 concepts · 3 units")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Add Chinese 101" }));
    expect(addCatalogCourse).toHaveBeenCalledWith("chinese-101");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows Added, a link to open it and a way to remove it once added", async () => {
    removeCatalogCourse.mockResolvedValue({ removed: true });
    render(<CatalogCard item={{ ...item, added: true }} />);
    expect(screen.getByText("Added")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add Chinese 101" })).toBeNull();
    expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/course/chinese-101");
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(removeCatalogCourse).toHaveBeenCalledWith("chinese-101");
  });

  it("shows the error and lets the student retry", async () => {
    addCatalogCourse.mockRejectedValueOnce(new Error("Can't reach the server."));
    render(<CatalogCard item={item} />);
    await userEvent.click(screen.getByRole("button", { name: "Add Chinese 101" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Can't reach the server.");
    expect(screen.getByRole("button", { name: "Add Chinese 101" })).toBeTruthy();
  });
});
