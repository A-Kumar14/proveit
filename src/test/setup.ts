import { demoStateForTests } from "./demo-state";

(globalThis as unknown as { __proveitTestSeedFactory?: () => unknown }).__proveitTestSeedFactory = demoStateForTests;
