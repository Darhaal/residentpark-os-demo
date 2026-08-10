// Title: Invitation Acceptance E2E Spec (confirmation enabled)
// Path: e2e/invitation-accept-confirm.spec.ts
// Functionality: Browser coverage for the confirmation-ENABLED invitation accept flow
//   register -> email confirmation -> /auth/callback consumes the token.

// This follows the REAL email-click flow because the callback uses PKCE
// (exchangeCodeForSession), whose code verifier is set by the browser at signUp — a
// generated admin link cannot satisfy it. It therefore needs a local Supabase with
// enable_confirmations=true plus the local Mailpit capture service, which is the dedicated
// `e2e-invite-confirm` CI job. Legacy Inbucket stacks are also supported. Gated on
// E2E_EMAIL_CONFIRM so it self-skips in the default (confirmations-off) E2E job and locally.

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
import { waitForConfirmationLink } from './inbucket';

const PASSWORD = (process.env.SEED_PASSWORD || 'ChangeMe-Local-Only-123!');
const ENABLED = process.env.E2E_EMAIL_CONFIRM === '1';

test.describe('token-bound invitation acceptance — confirmation enabled', () => {
  test.beforeEach(() => {
    test.skip(!ENABLED || !canRunInvitationE2E(), 'requires the confirmation-enabled local E2E job');
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

  async function registerWithoutSession(page: Page, email: string, token: string): Promise<void> {
    await page.goto(`/register?invite=${token}`);
    await page.locator('#fullName').fill('E2E Confirm Invitee');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(PASSWORD);
    await page.locator('#terms').check();
    await page.locator('button[type=submit]').click();
    // With confirmations enabled, signUp returns no session; the page still navigates
    // home, and the PKCE code-verifier cookie is now set for the email-link exchange.
    await page.waitForURL((url) => !url.pathname.startsWith('/register'));
  }

  test('email confirmation completes token-bound acceptance via /auth/callback', async ({ page }) => {
    const email = `e2e-confirm-${Date.now()}@example.test`;
    const token = crypto.randomUUID();
    const apt = await createApartment();
    created.apartmentIds.push(apt.id);
    created.tokens.push(token);
    created.emails.push(email);
    await createInvitation(email, apt.id, token);

    await registerWithoutSession(page, email, token);

    // Not approved before the email is confirmed.
    expect((await getProfileByEmail(email))?.approval_status).not.toBe('approved');

    // Follow the real confirmation link from the captured email. It routes through
    // /auth/callback, which exchanges the code against the browser's PKCE verifier cookie
    // and runs the token-bound acceptance.
    const link = await waitForConfirmationLink(email);
    await page.goto(link);
    await page.waitForURL((url) => !url.pathname.startsWith('/auth/callback'));

    await expect
      .poll(async () => (await getProfileByEmail(email))?.approval_status, { timeout: 20_000 })
      .toBe('approved');
    expect((await getProfileByEmail(email))?.apartment_id).toBe(apt.id);
    expect(await getInvitationStatus(token)).toBe('accepted');
  });
});
