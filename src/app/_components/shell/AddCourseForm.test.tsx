// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
const { api } = vi.hoisted(() => ({ api: { uploadCourse: vi.fn(), courseJob: vi.fn(), cancelCourseJob: vi.fn(), connectApp: vi.fn(), disconnectApp: vi.fn(), importFromApp: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@proveit/lib/api", () => ({ api }));

import { AddCourseForm } from "./AddCourseForm";
import type { AppStatus } from "../apps/useConnect";

const apps = (granola = false): AppStatus[] => [
  { id: "granola", name: "Granola", blurb: "Meeting notes.", needs: "Free plans see 30 days.", connected: granola },
  { id: "wispr", name: "Wispr Flow", blurb: "Notetaker.", needs: "Needs MCP access.", connected: false },
];
const assign = vi.fn();
const STAGES = [["reading", "Reading your files"], ["outline", "Finding the topics"], ["building", "Building the concept map"], ["saving", "Saving your notes for the tutor"]] as const;
/** A job as the server reports it, sitting in the given stage. */
const job = (stage: string, over: object = {}) => {
  const at = STAGES.findIndex(([id]) => id === stage);
  return { id: "j1", name: "Biology", stage, elapsedMs: 4000, files: [{ name: "bio.md", state: "done", note: "120 words" }], stages: STAGES.map(([id, label], i) => ({ id, label, state: stage === "done" || i < at ? "done" : i === at ? "active" : "waiting" })), ...over };
};

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
    api.uploadCourse.mockResolvedValue({ jobId: "j1" });
    api.courseJob.mockResolvedValue(job("done", { courseId: "biology" }));
    render(<AddCourseForm apps={apps()} />);
    await userEvent.type(screen.getByLabelText("Course name"), "Biology");
    await userEvent.upload(screen.getByLabelText("Choose notes"), new File(["# Bio"], "bio.md", { type: "text/markdown" }));
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Build concept map" }));
    expect(api.uploadCourse).toHaveBeenCalledWith("Biology", [expect.objectContaining({ name: "bio.md" })]);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/course/biology?built=1"));
  });

  it("shows which stage the build is in, each file, and the time so far, while it runs", async () => {
    api.uploadCourse.mockResolvedValue({ jobId: "j1" });
    api.courseJob.mockResolvedValue(job("outline", { files: [{ name: "bio.md", state: "done", note: "120 words" }, { name: "scan.pdf", state: "reading" }] }));
    render(<AddCourseForm apps={apps()} />);
    await userEvent.type(screen.getByLabelText("Course name"), "Biology");
    await userEvent.upload(screen.getByLabelText("Choose notes"), new File(["# Bio"], "bio.md", { type: "text/markdown" }));
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Build concept map" }));
    expect(await screen.findByText("Building Biology")).toBeTruthy();
    const steps = screen.getAllByRole("listitem").filter((li) => li.hasAttribute("aria-current") || /Reading your files|Finding the topics|Building the concept map|Saving your notes/.test(li.textContent ?? ""));
    expect(steps.find((li) => li.getAttribute("aria-current") === "step")!.textContent).toContain("Finding the topics");
    expect(screen.getByText("120 words")).toBeTruthy();
    expect(screen.getByText("Reading...")).toBeTruthy();
    expect(screen.getByLabelText("Time so far").textContent).toBe("0:04");
    expect(push).not.toHaveBeenCalled();
  });

  it("lets the student cancel a running build", async () => {
    api.uploadCourse.mockResolvedValue({ jobId: "j1" });
    api.courseJob.mockResolvedValue(job("reading"));
    api.cancelCourseJob.mockResolvedValue({ cancelled: true });
    render(<AddCourseForm apps={apps()} />);
    await userEvent.type(screen.getByLabelText("Course name"), "Biology");
    await userEvent.upload(screen.getByLabelText("Choose notes"), new File(["# Bio"], "bio.md", { type: "text/markdown" }));
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Build concept map" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(api.cancelCourseJob).toHaveBeenCalledWith("j1");
  });

  it("shows the reason and the stage a build stopped in, and lets the student try again", async () => {
    api.uploadCourse.mockResolvedValue({ jobId: "j1" });
    api.courseJob.mockResolvedValue(job("failed", { error: "That doesn't look like course material.", stages: STAGES.map(([id, label], i) => ({ id, label, state: i === 0 ? "done" : i === 1 ? "failed" : "waiting" })) }));
    render(<AddCourseForm apps={apps()} />);
    await userEvent.type(screen.getByLabelText("Course name"), "Biology");
    await userEvent.upload(screen.getByLabelText("Choose notes"), new File(["# Bio"], "bio.md", { type: "text/markdown" }));
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Build concept map" }));
    expect((await screen.findByRole("alert")).textContent).toContain("That doesn't look like course material.");
    expect(screen.getByText("The build stopped")).toBeTruthy();
    expect(screen.getByText(/stopped here/).textContent).toContain("stopped here");
    expect((await screen.findByRole("button", { name: "Try again" }) as HTMLButtonElement).disabled).toBe(false);
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
    expect(push).toHaveBeenCalledWith("/course/organic-chemistry?built=1");
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
