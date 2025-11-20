import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for browser compatibility tests
 * Tests CWC in Chromium (Firefox and WebKit can be added if needed)
 */
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 0 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "html",
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  use: {
    trace: "on-first-retry",
    navigationTimeout: 15000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "yarn serve:test",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
