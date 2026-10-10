// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
const { api } = vi.hoisted(() => ({ api: { uploadCourse: vi.fn(), connectApp: vi.fn(), disconnectApp: vi.fn(), importFromApp: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@proveit/lib/api", () => ({ api }));

import { AddCourseForm } from "./AddCourseForm";
import type { AppStatus } from "../apps/useConnect";

const apps = (granola = false): AppStatus[] => [
  { id: "granola", name: "Granola", blurb: "Meeting notes.", needs: "Free plans see 30 days.", connected: granola },
  { id: "wispr", name: "Wispr Flow", blurb: "Notetaker.", needs: "Needs MCP access.", connected: false },
];
const assign = vi.fn();

beforeEach(() => {
  Object.values(api).forEach((m) => m.mockReset());
  push.mockReset(); refresh.mockReset(); assign.mockReset();
  Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
});
afterEach(cleanup);

describe("AddCourseForm, starting from nothing", () => {
  it("keeps Build course off until there is a name, a file and the rights box ticked", async () => {
    render(<AddCourseForm apps={apps()} />);
    const build = screen.getByRole("button", { name: "Build concept map" }) as HTMLButtonElement;
    expect(build.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText("Course name"), "Biology");
    await userEvent.upload(screen.getByLabelText("Choose notes"), new File(["# Bio"], "bio.md", { type: "text/markdown" }));
    expect(build.disabled).toBe(true);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(build.disabled).toBe(false);
  });

  it("builds the course and opens it", async () => {
    api.uploadCourse.mockResolvedValue({ courseId: "biology" });
    render(<AddCourseForm apps={apps()} />);
    await userEvent.type(screen.getByLabelText("Course name"), "Biology");
    await userEvent.upload(screen.getByLabelText("Choose notes"), new File(["# Bio"], "bio.md", { type: "text/markdown" }));
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Build concept map" }));
    expect(api.uploadCourse).toHaveBeenCalledWith("Biology", [expect.objectContaining({ name: "bio.md" })]);
    expect(push).toHaveBeenCalledWith("/course/biology");
  });

  it("shows why a build failed and lets the student fix it", async () => {
    api.uploadCourse.mockRejectedValue(new Error("No AI key is set."));
    render(<AddCourseForm apps={apps()} />);
    await userEvent.type(screen.getByLabelText("Course name"), "Notes");
    await userEvent.upload(screen.getByLabelText("Choose notes"), new File(["text"], "n.txt", { type: "text/plain" }));
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Build concept map" }));
    expect((await screen.findByRole("alert")).textContent).toContain("No AI key is set.");
    expect((screen.getByRole("button", { name: "Build concept map" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("explains what connecting does, before asking for anything", async () => {
    render(<AddCourseForm apps={apps()} />);
    expect(screen.getAllByText("How this works")).toHaveLength(2);
    await userEvent.click(screen.getAllByText("How this works")[0]!);
    expect(screen.getByText(/we never see your password/)).toBeTruthy();
    expect(screen.getByText("Free plans see 30 days.")).toBeTruthy();
  });

  it("sends the browser to the app's own sign-in page when connecting", async () => {
    api.connectApp.mockResolvedValue({ url: "https://auth.example/authorize?x=1" });
    render(<AddCourseForm apps={apps()} />);
    await userEvent.click(screen.getByRole("button", { name: "Connect Granola" }));
    expect(api.connectApp).toHaveBeenCalledWith("granola", "/?add=1");
    expect(assign).toHaveBeenCalledWith("https://auth.example/authorize?x=1");
  });

  it("shows a failed connection and stays put", async () => {
    api.connectApp.mockRejectedValue(new Error("Couldn't reach Granola. Retry in a moment."));
    render(<AddCourseForm apps={apps()} />);
    await userEvent.click(screen.getByRole("button", { name: "Connect Granola" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't reach Granola");
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("AddCourseForm, with an app connected", () => {
  it("asks for a topic and imports into a new course", async () => {
    api.importFromApp.mockResolvedValue({ id: "organic-chemistry", concepts: 6, documents: 3 });
    render(<AddCourseForm apps={apps(true)} notice={{ connected: "granola" }} />);
    expect(screen.getByRole("status").textContent).toContain("Connected Granola");
    const go = screen.getByRole("button", { name: "Import notes and build course" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText("Topic to import from Granola"), "Organic chemistry");
    await userEvent.click(go);
    expect(api.importFromApp).toHaveBeenCalledWith("granola", "Organic chemistry", undefined);
    expect(push).toHaveBeenCalledWith("/course/organic-chemistry");
  });

  it("disconnects", async () => {
    api.disconnectApp.mockResolvedValue({ ok: true });
    render(<AddCourseForm apps={apps(true)} />);
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(api.disconnectApp).toHaveBeenCalledWith("granola");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a cancelled or failed connection from the redirect", () => {
    render(<AddCourseForm apps={apps()} notice={{ error: "You cancelled the connection." }} />);
    expect(screen.getByRole("alert").textContent).toContain("You cancelled the connection.");
  });
});
