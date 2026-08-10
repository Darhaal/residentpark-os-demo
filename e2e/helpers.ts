// Title: E2E Test Helpers
// Path: e2e/helpers.ts
// Functionality: Shared Playwright helpers for auth setup, route navigation, and stable assertions.

import { type Page } from '@playwright/test';

// Demo accounts seeded by scripts/seed-demo.mjs.
export const PASSWORD = (process.env.SEED_PASSWORD || 'ChangeMe-Local-Only-123!');

export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
