// Title: Resident Experience E2E Spec
// Path: e2e/resident.spec.ts
// Functionality: Playwright coverage for the resident dashboard and parking workflows.

// Resident critical paths (checklist 5.2 / 5.5): garage-map link, self-service profile
// (name/phone only, no escalation), and the pending-account verification screen.

import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('resident dashboard links to the garage map', async ({ page }) => {
  await login(page, 'alice@demo.local');
  await page.getByRole('link', { name: /View Garage Map/i }).first().click();
  await expect(page).toHaveURL(/\/parking/);
});

test('resident profile exposes name/phone but no role/status escalation', async ({ page }) => {
  await login(page, 'alice@demo.local');
  await page.goto('/profile');
  await expect(page.getByText(/Full Name/i)).toBeVisible();
  await expect(page.getByText(/Phone/i)).toBeVisible();
  // Nothing on the profile page should let a resident change their role.
  await expect(page.getByText(/superadmin/i)).toHaveCount(0);
});

test('a pending resident sees the verification screen, not the dashboard', async ({ page }) => {
  await login(page, 'erin.pending@demo.local');
  await expect(page.getByText(/Verification in Progress/i)).toBeVisible();
  await expect(page.getByText(/View Garage Map/i)).toHaveCount(0);
});
