import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.js"],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
