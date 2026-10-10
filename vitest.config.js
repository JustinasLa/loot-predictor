import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    restoreMocks: true,
    unstubGlobals: true,
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
