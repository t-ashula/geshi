import { defineConfig } from "@playwright/test";

export default defineConfig({
  outputDir: "../tmp/playwright/test-results",
  testDir: "./cases",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_FRONTEND_URL ?? "http://127.0.0.1:4173",
    headless: true,
    trace: "retain-on-failure",
  },
});
