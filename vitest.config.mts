import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: { alias: { "@proveit": src("./src"), "server-only": src("./src/test/server-only.ts") } },
  test: { environment: "node" },
});
