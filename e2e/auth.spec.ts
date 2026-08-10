// Title: Authentication E2E Spec
// Path: e2e/auth.spec.ts
// Functionality: Playwright coverage for login, logout, and authentication flow behavior.

// Role-based critical-path E2E. Verifies the auth gate and that login routes each
// role to the right home (admin panel vs resident dashboard) and keeps residents out
// of /admin. Uses the demo accounts from scripts/seed-demo.mjs.

import { test, expect, type Page } from '@playwright/test';

const PASSWORD = (process.env.SEED_PASSWORD || 'ChangeMe-Local-Only-123!');
const SUPERADMIN = 'sam.super@demo.local';
const RESIDENT = 'alice@demo.local';

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
}

test('unauthenticated user is redirected to login from a protected route', async ({ page }) => {
  await page.goto('/admin/parking');
  await expect(page).toHaveURL(/\/login/);
});

test('superadmin signs in and lands on the admin panel', async ({ page }) => {
  await login(page, SUPERADMIN);
  await page.waitForURL(/\/admin(\/|$)/);
  await expect(page.getByText('Operational Reports')).toBeVisible();
});

test('resident signs in and lands on the resident dashboard, not the admin panel', async ({ page }) => {
  await login(page, RESIDENT);
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  await expect(page).not.toHaveURL(/\/admin/);
  await expect(page.getByText(/Assigned Unit/i)).toBeVisible();
});

test('a resident cannot reach the admin panel', async ({ page }) => {
  await login(page, RESIDENT);
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  await page.goto('/admin/reports');
  await expect(page).not.toHaveURL(/\/admin\/reports/);
});
