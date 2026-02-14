import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
    baseURL: "http://localhost:3456",
  },
  // Global setup: generate HTML files from fixtures before tests run
  globalSetup: "./global-setup.ts",
  // Serve the generated HTML files
  webServer: {
    command: "npx tsx serve-generated.ts",
    port: 3456,
    reuseExistingServer: !process.env.CI,
  },
});
