// Title: Invitation Acceptance E2E Spec
// Path: e2e/invitation-accept.spec.ts
// Functionality: Browser coverage for token-bound invitation acceptance.

// Drives the confirmation-DISABLED (inline) acceptance path: the disposable local
// Supabase the E2E job starts has `enable_confirmations = false`, so signUp returns a
// session and the register page consumes the invitation inline. The specs assert the
// authoritative outcome through a service-role client (profile approval + apartment
// assignment + invitation status) rather than brittle UI text, and self-skip unless
// pointed at a local stack so they never write to a real project.
//
// The confirmation-ENABLED (auth/callback after email click) path is covered at the data
// layer by invitation-consume.db.test.ts; a full browser pass for it needs email-capture
// (Inbucket) wiring and is tracked as a follow-up.

import { test, expect, type Page } from '@playwright/test';
import {
  canRunInvitationE2E,
  createApartment,
  createInvitation,
  getProfileByEmail,
  getInvitationStatus,
  deleteUserByEmail,
  deleteApartment,
  deleteInvitation,
} from './db';

const PASSWORD = (process.env.SEED_PASSWORD || 'ChangeMe-Local-Only-123!');

test.describe('token-bound invitation acceptance', () => {
  test.beforeEach(() => {
    test.skip(process.env.E2E_EMAIL_CONFIRM === '1', 'inline path runs only with confirmations disabled');
    test.skip(!canRunInvitationE2E(), 'requires a local Supabase with a service-role key');
  });

  const created: { emails: string[]; apartmentIds: string[]; tokens: string[] } = {
    emails: [],
    apartmentIds: [],
    tokens: [],
  };

  test.afterEach(async () => {
    for (const email of created.emails) await deleteUserByEmail(email).catch(() => {});
    for (const token of created.tokens) await deleteInvitation(token).catch(() => {});
    for (const id of created.apartmentIds) await deleteApartment(id).catch(() => {});
    created.emails = [];
    created.apartmentIds = [];
    created.tokens = [];
  });

  async function register(page: Page, email: string, token?: string): Promise<void> {
    await page.goto(token ? `/register?invite=${token}` : '/register');
    await page.locator('#fullName').fill('E2E Invitee');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(PASSWORD);
    await page.locator('#terms').check();
    await page.locator('button[type=submit]').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/register'));
  }

  test('a valid accept-link approves the invited resident and assigns the apartment', async ({ page }) => {
    const email = `e2e-accept-${Date.now()}@example.test`;
    const token = crypto.randomUUID();
    const apt = await createApartment();
    created.apartmentIds.push(apt.id);
    created.tokens.push(token);
    created.emails.push(email);
    await createInvitation(email, apt.id, token);

    await register(page, email, token);

    // Authoritative state: token-bound acceptance ran inline at signUp.
    await expect.poll(async () => (await getProfileByEmail(email))?.approval_status).toBe('approved');
    const profile = await getProfileByEmail(email);
    expect(profile?.apartment_id).toBe(apt.id);
    expect(await getInvitationStatus(token)).toBe('accepted');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('registering without the token leaves the account pending (no silent approval)', async ({ page }) => {
    const email = `e2e-notoken-${Date.now()}@example.test`;
    const token = crypto.randomUUID();
    const apt = await createApartment();
    created.apartmentIds.push(apt.id);
    created.tokens.push(token);
    created.emails.push(email);
    // A valid invitation exists for this email, but the user never presents the link.
    await createInvitation(email, apt.id, token);

    await register(page, email);

    await expect.poll(async () => (await getProfileByEmail(email))?.id, { timeout: 15_000 }).toBeTruthy();
    const profile = await getProfileByEmail(email);
    expect(profile?.approval_status).not.toBe('approved');
    expect(profile?.apartment_id ?? null).toBeNull();
    expect(await getInvitationStatus(token)).toBe('pending');
  });

  test('a wrong token does not approve even when a valid invitation exists for the email', async ({ page }) => {
    const email = `e2e-wrong-${Date.now()}@example.test`;
    const realToken = crypto.randomUUID();
    const apt = await createApartment();
    created.apartmentIds.push(apt.id);
    created.tokens.push(realToken);
    created.emails.push(email);
    await createInvitation(email, apt.id, realToken);

    // Presents a different (random) token than the one bound to the email.
    await register(page, email, crypto.randomUUID());

    await expect.poll(async () => (await getProfileByEmail(email))?.id, { timeout: 15_000 }).toBeTruthy();
    const profile = await getProfileByEmail(email);
    expect(profile?.approval_status).not.toBe('approved');
    expect(profile?.apartment_id ?? null).toBeNull();
    expect(await getInvitationStatus(realToken)).toBe('pending');
  });
});
