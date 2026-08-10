// Title: Playwright Configuration
// Path: playwright.config.ts
// Functionality: End-to-end browser test configuration for local and CI validation.

import { defineConfig, devices } from '@playwright/test';

// Role-based browser E2E. The dev server reads .env.local for Supabase; the specs sign
// in with the demo accounts created by `npm run seed:demo`. In CI the workflow seeds
// the local stack first (see ci.yml).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
