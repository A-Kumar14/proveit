import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: { alias: { "@proveit": src("./src"), "server-only": src("./src/test/server-only.ts") } },
  // Most tests assert against the seeded demo. real-mode.test.ts sets its own value before the store loads.
  test: { environment: "node", env: { PROVEIT_DATA: "demo" } },
});
