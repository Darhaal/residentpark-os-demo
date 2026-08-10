// Title: Admin Access E2E Spec
// Path: e2e/admin-access.spec.ts
// Functionality: Playwright coverage for admin route protection and role-aware access.

// Admin/superadmin access (checklist 5.3 / 5.4): the admin panel opens on Reports, and
// the system audit log is reachable by a superadmin.

import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('admin panel opens on Reports', async ({ page }) => {
  await login(page, 'sam.super@demo.local');
  await page.goto('/admin');
  await expect(page.getByText('Operational Reports')).toBeVisible();
});

test('superadmin can open the system audit logs', async ({ page }) => {
  await login(page, 'sam.super@demo.local');
  await page.goto('/admin/logs');
  await expect(page).toHaveURL(/\/admin\/logs/);
  await expect(page.getByText(/System Audit Logs/i)).toBeVisible();
});

test('every admin section renders for a superadmin', async ({ page }) => {
  await login(page, 'sam.super@demo.local');
  const sections: ReadonlyArray<readonly [string, string]> = [
    ['/admin/approvals', 'Approval Center'],
    ['/admin/parking', 'Parking Map'],
    ['/admin/issues', 'Parking Issues'],
    ['/admin/disruptions', 'Construction & Disruptions'],
    ['/admin/apartments', 'Property Directory'],
    ['/admin/vehicles', 'Vehicle Directory'],
    ['/admin/users', 'Identity Directory'],
    ['/admin/notices', 'Notices'],
  ];
  for (const [path, title] of sections) {
    await page.goto(path);
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
  }
});
