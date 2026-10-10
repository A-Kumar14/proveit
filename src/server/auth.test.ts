import { afterEach, describe, expect, it, vi } from "vitest";
import { authEnabled, currentProfile, currentUserId, LOCAL_USER, UnauthorizedError } from "./auth";

const clerk = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: clerk.userId }) }));
afterEach(() => { vi.unstubAllEnvs(); clerk.userId = null; });
const keys = (pk: string, sk: string) => { vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", pk); vi.stubEnv("CLERK_SECRET_KEY", sk); };

describe("accounts", () => {
  it("requires a signed-in Clerk user when accounts are enabled", async () => {
    keys("pk_test_x", "sk_test_x");
    await expect(currentUserId()).rejects.toBeInstanceOf(UnauthorizedError);
    clerk.userId = "user_A";
    expect(await currentUserId()).toBe("user_A");
  });

  it("are off unless both keys are set", () => {
    keys("", "");
    expect(authEnabled()).toBe(false);
    keys("pk_test_x", "");
    expect(authEnabled()).toBe(false);
    keys("", "sk_test_x");
    expect(authEnabled()).toBe(false);
    keys("pk_test_x", "sk_test_x");
    expect(authEnabled()).toBe(true);
  });

  it("run as the local user with no profile when off", async () => {
    keys("", "");
    expect(await currentUserId()).toBe(LOCAL_USER);
    expect(await currentProfile()).toBeNull();
  });
});
