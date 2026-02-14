import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    projects: [
      "packages/core",
      "packages/renderer",
      "packages/html-builder",
      // Note: packages/service uses @cloudflare/vitest-pool-workers, configured separately
    ],
  },
});
