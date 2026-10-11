import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    restoreMocks: true,
    unstubGlobals: true,
    // App tests import the whole app; under coverage with many workers the
    // first test in a file can pass 5s on a busy machine.
    testTimeout: 15000,
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.js", "tools/**/*.mjs"],
      reporter: ["text", "html", "json", "json-summary"],
      thresholds: {
        perFile: true,
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
