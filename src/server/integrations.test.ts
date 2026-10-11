import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const tools = vi.fn();
const close = vi.fn();
const createMCPClient = vi.fn();
vi.mock("@ai-sdk/mcp", () => ({ auth: (...a: unknown[]) => auth(...a), createMCPClient: (...a: unknown[]) => createMCPClient(...a) }));
const generateText = vi.fn();
let ai = true;
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a), Output: { object: (o: unknown) => o }, stepCountIs: (n: number) => ({ steps: n }) }));
vi.mock("./ai", () => ({ aiEnabled: () => ai, model: () => "mock-model" }));

import { beginConnect, completeConnect, connectionStatus, disconnect, fetchNotes, importCourse, isReadTool, originOf, safeReturn } from "./integrations";
import { MaterialError } from "./materials";
import { closePersistenceForTests } from "./persistence";
import { getSidebar } from "./store";

const U = "user_1";
const ORIGIN = "http://localhost:3000";
const body = "# Lecture\nKey idea: enzymes lower activation energy. Example: catalase breaks down hydrogen peroxide.";

beforeEach(() => {
  vi.stubEnv("PROVEIT_DB_PATH", ":memory:");
  ai = true;
  for (const m of [auth, tools, close, createMCPClient, generateText]) m.mockReset();
  createMCPClient.mockResolvedValue({ tools, close });
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  (globalThis as { __proveitMaterials?: unknown }).__proveitMaterials = undefined;
});
afterEach(() => { closePersistenceForTests(); vi.unstubAllEnvs(); });

/** Pretends to be the provider: asks the browser to go to its sign-in page, or saves tokens when given a code. */
const fakeAuth = () => auth.mockImplementation(async (p: { redirectToAuthorization: (u: URL) => void; saveState?: (s: string) => void; state?: () => string; saveTokens: (t: unknown) => void }, o: { authorizationCode?: string }) => {
  if (o.authorizationCode) { p.saveTokens({ access_token: "tok", token_type: "Bearer" }); return "AUTHORIZED"; }
  const state = p.state!();
  p.saveState!(state);
  p.redirectToAuthorization(new URL(`https://auth.example/authorize?state=${state}`));
  return "REDIRECT";
});

describe("connecting", () => {
  it("starts at the provider's own sign-in page and records nothing as connected yet", async () => {
    fakeAuth();
    const r = await beginConnect(U, "granola", ORIGIN, "/?add=1");
    expect(r).toMatchObject({ url: expect.stringContaining("https://auth.example/authorize") });
    expect(auth.mock.calls[0]![1]).toMatchObject({ serverUrl: "https://mcp.granola.ai/mcp" });
    expect(connectionStatus(U).find((a) => a.id === "granola")!.connected).toBe(false);
  });

  it("registers the callback on this app and asks for no client secret", async () => {
    fakeAuth();
    await beginConnect(U, "wispr", ORIGIN, "/account");
    const provider = auth.mock.calls[0]![0];
    expect(provider.redirectUrl).toBe("http://localhost:3000/api/integrations/wispr/callback");
    expect(provider.clientMetadata).toMatchObject({ client_name: "ProveIt", token_endpoint_auth_method: "none", redirect_uris: ["http://localhost:3000/api/integrations/wispr/callback"] });
    expect(auth.mock.calls[0]![1].serverUrl).toBe("https://api.wisprflow.ai/connect/mcp");
  });

  it("finishes with the code, marks the app connected and returns the page the student came from", async () => {
    fakeAuth();
    const { url } = (await beginConnect(U, "granola", ORIGIN, "/?add=1")) as { url: string };
    const state = new URL(url).searchParams.get("state")!;
    const done = await completeConnect(U, "granola", ORIGIN, "code123", state);
    expect(done).toEqual({ returnTo: "/?add=1" });
    expect(auth.mock.calls[1]![1]).toMatchObject({ authorizationCode: "code123", callbackState: state });
    expect(connectionStatus(U).find((a) => a.id === "granola")!.connected).toBe(true);
  });

  it("refuses a callback whose state doesn't match, so a forged link can't connect an account", async () => {
    fakeAuth();
    await beginConnect(U, "granola", ORIGIN, "/account");
    await expect(completeConnect(U, "granola", ORIGIN, "code", "forged")).rejects.toBeInstanceOf(MaterialError);
    await expect(completeConnect(U, "granola", ORIGIN, "code", null)).rejects.toBeInstanceOf(MaterialError);
    expect(connectionStatus(U).find((a) => a.id === "granola")!.connected).toBe(false);
  });

  it("keeps each user's connection separate and disconnects cleanly", async () => {
    fakeAuth();
    const { url } = (await beginConnect(U, "granola", ORIGIN, "/account")) as { url: string };
    await completeConnect(U, "granola", ORIGIN, "c", new URL(url).searchParams.get("state"));
    expect(connectionStatus("someone_else").every((a) => !a.connected)).toBe(true);
    disconnect(U, "granola");
    expect(connectionStatus(U).every((a) => !a.connected)).toBe(true);
  });

  it("says it's already connected when the provider needs no sign-in", async () => {
    auth.mockResolvedValue("AUTHORIZED");
    expect(await beginConnect(U, "granola", ORIGIN, "/account")).toEqual({ connected: true });
  });
});

describe("redirect safety", () => {
  it("only returns to paths on this site", () => {
    expect(safeReturn("/?add=1")).toBe("/?add=1");
    expect(safeReturn("//evil.com")).toBe("/account");
    expect(safeReturn("https://evil.com")).toBe("/account");
    expect(safeReturn("/\\evil.com")).toBe("/account");
    expect(safeReturn(undefined)).toBe("/account");
  });

  it("uses APP_URL for the callback when set", () => {
    vi.stubEnv("APP_URL", "https://app.example.com/");
    expect(originOf(new Request("http://internal:3000/x"))).toBe("https://app.example.com");
    vi.stubEnv("APP_URL", "");
    expect(originOf(new Request("http://internal:3000/x"))).toBe("http://internal:3000");
  });
});

describe("the import agent", () => {
  async function connected() {
    fakeAuth();
    const { url } = (await beginConnect(U, "granola", ORIGIN, "/account")) as { url: string };
    await completeConnect(U, "granola", ORIGIN, "c", new URL(url).searchParams.get("state"));
    auth.mockClear();
  }

  it("only lets the agent use tools that read", () => {
    for (const ok of ["list_meetings", "get_meetings", "get_meeting_transcript", "query_granola_meetings", "search_notes", "read_note"]) expect(isReadTool(ok)).toBe(true);
    for (const no of ["create_note", "update_task", "delete_meeting", "send_message", "write_file", "get_and_delete", "set_status"]) expect(isReadTool(no)).toBe(false);
  });

  it("needs a connection and a key before it does anything", async () => {
    await expect(fetchNotes(U, "granola", ORIGIN, "biology")).rejects.toThrow(/Connect Granola first/);
    await connected();
    ai = false;
    await expect(fetchNotes(U, "granola", ORIGIN, "biology")).rejects.toThrow(/no AI key/);
    expect(createMCPClient).not.toHaveBeenCalled();
  });

  it("gives the agent only the read tools, and returns what it wrote up as markdown files", async () => {
    await connected();
    tools.mockResolvedValue({ list_meetings: {}, get_meetings: {}, create_note: {}, delete_meeting: {} });
    generateText.mockResolvedValueOnce({ output: { documents: [{ title: "Enzymes lecture", markdown: body }, { title: "Too short", markdown: "no" }] } });
    const sources = await fetchNotes(U, "granola", ORIGIN, "biology");
    expect(Object.keys(generateText.mock.calls[0]![0].tools).sort()).toEqual(["get_meetings", "list_meetings"]);
    expect(sources).toEqual([expect.objectContaining({ name: "Enzymes lecture.md", mime: "text/markdown", text: body })]);
    expect(close).toHaveBeenCalled();
  });

  it("closes the connection and explains when nothing relevant was found", async () => {
    await connected();
    tools.mockResolvedValue({ list_meetings: {} });
    generateText.mockResolvedValueOnce({ output: { documents: [] } });
    await expect(fetchNotes(U, "granola", ORIGIN, "knitting")).rejects.toThrow(/couldn't find notes about "knitting"/);
    expect(close).toHaveBeenCalled();
  });

  it("closes the connection when the app offers nothing readable", async () => {
    await connected();
    tools.mockResolvedValue({ create_note: {} });
    await expect(fetchNotes(U, "granola", ORIGIN, "biology")).rejects.toThrow(/any way to read notes/);
    expect(close).toHaveBeenCalled();
  });

  it("builds a course from the imported notes", async () => {
    await connected();
    tools.mockResolvedValue({ list_meetings: {} });
    const notes = "# Enzymes\n## Catalysis\n### Activation energy\nEnzymes lower the activation energy of a reaction.\n### Active site\nThe active site binds the substrate tightly.\n### Cofactors\nCofactors help enzymes work and are often metals.\n";
    generateText.mockResolvedValueOnce({ output: { documents: [{ title: "Biochem lecture", markdown: notes }] } });
    const r = await importCourse(U, "granola", ORIGIN, "Biochemistry", "Biochem");
    expect(r).toMatchObject({ id: "biochem", concepts: 3, documents: 1 });
    expect(getSidebar().courses.some((c) => c.id === "biochem")).toBe(true);
  });
});
