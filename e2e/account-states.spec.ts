// Title: Account States E2E Spec
// Path: e2e/account-states.spec.ts
// Functionality: Playwright coverage for pending, suspended, rejected, and active account states.

// Resident account states (checklist 5.5). Pending is covered in resident.spec; this
// settles the two that manual QA couldn't confirm cleanly: suspended and missing-profile.
// Uses dedicated seeded fixtures (frank.suspended / ghost.noprofile). Signs in without
// asserting the URL, since the point is which screen the account state lands on.

import { test, expect, type Page } from '@playwright/test';
import { PASSWORD } from './helpers';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
}

test('a suspended resident sees the Access Suspended screen, not the dashboard', async ({ page }) => {
  await signIn(page, 'frank.suspended@demo.local');
  await expect(page.getByText(/Access Suspended/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/View Garage Map/i)).toHaveCount(0);
});

test('a user with no profile sees the Profile Not Found screen', async ({ page }) => {
  await signIn(page, 'ghost.noprofile@demo.local');
  await expect(page.getByText(/Profile Not Found/i)).toBeVisible({ timeout: 30_000 });
});
