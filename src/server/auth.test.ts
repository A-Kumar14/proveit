import { afterEach, describe, expect, it, vi } from "vitest";
import { authEnabled, currentProfile, currentUserId, LOCAL_USER } from "./auth";

afterEach(() => vi.unstubAllEnvs());
const keys = (pk: string, sk: string) => { vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", pk); vi.stubEnv("CLERK_SECRET_KEY", sk); };

describe("accounts", () => {
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
