// Title: Core UI E2E Spec
// Path: e2e/ui.spec.ts
// Functionality: Playwright smoke coverage for primary navigation and page rendering.

// Navbar "?" help button (checklist 5.6 / 5.7): role-aware quick guide that opens from
// the navbar and closes on Escape.

import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('help button shows the admin guide and closes on Escape', async ({ page }) => {
  await login(page, 'sam.super@demo.local');
  await page.getByRole('button', { name: 'Help and quick guide' }).click();
  await expect(page.getByText('Quick guide')).toBeVisible();
  await expect(page.getByText('Running the building')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Quick guide')).not.toBeVisible();
});

test('help button shows the resident guide for a resident', async ({ page }) => {
  await login(page, 'alice@demo.local');
  await page.getByRole('button', { name: 'Help and quick guide' }).click();
  await expect(page.getByText('Your resident portal')).toBeVisible();
});
