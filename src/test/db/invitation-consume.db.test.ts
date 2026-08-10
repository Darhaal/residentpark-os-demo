// Title: Invitation Consume DB Test
// Path: src/test/db/invitation-consume.db.test.ts
// Functionality: Database coverage for token-bound invitation acceptance.

// tx_consume_invitation(p_token) (0006/0009, token-bound in 0017): a pending
// resident is approved + assigned ONLY when they present the matching unexpired
// one-time token AND their session email equals the invited email. It is single-use
// and rejects wrong-token, wrong-email, expired, and missing-token attempts.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createApartment, createResident, deleteApartment, deleteUser, serviceClient, signedInClient } from './harness';

describe.skipIf(!hasDbEnv())('tx_consume_invitation token-bound (0017)', () => {
  const users: string[] = [];
  const apts: string[] = [];

  afterEach(async () => {
    while (users.length) {
      const id = users.pop();
      if (id) await deleteUser(id);
    }
    while (apts.length) {
      const id = apts.pop();
      if (id) await deleteApartment(id);
    }
  });

  async function invite(email: string, apartmentId: string, opts: { expiresAt?: string } = {}): Promise<string> {
    const token = crypto.randomUUID();
    const row: Record<string, unknown> = { email, role: 'resident', apartment_id: apartmentId, status: 'pending', token };
    if (opts.expiresAt) row.expires_at = opts.expiresAt;
    const { error } = await serviceClient().from('invitations').insert(row);
    if (error) throw new Error(`invite insert failed: ${error.message}`);
    return token;
  }

  async function approvalOf(userId: string): Promise<{ approval_status?: string; apartment_id?: string | null }> {
    const { data } = await serviceClient().from('profiles').select('approval_status, apartment_id').eq('id', userId).single();
    return data ?? {};
  }

  it('accepts with the matching token → approved + assigned, and is single-use', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const user = await createResident(); // pending, no apartment
    users.push(user.id);
    const token = await invite(user.email, apt.id);

    const client = await signedInClient(user.email, user.password);
    const { data: result, error } = await client.rpc('tx_consume_invitation', { p_token: token });
    expect(error).toBeNull();
    expect(result?.consumed).toBe(true);
    expect(result?.apartment_number).toBe(apt.number);

    const after = await approvalOf(user.id);
    expect(after.approval_status).toBe('approved');
    expect(after.apartment_id).toBe(apt.id);

    // Already approved + assigned → no longer eligible (single use).
    const { data: again } = await client.rpc('tx_consume_invitation', { p_token: token });
    expect(again?.consumed).toBe(false);
  });

  it('rejects a wrong token even when one exists for the email', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const user = await createResident();
    users.push(user.id);
    await invite(user.email, apt.id);

    const client = await signedInClient(user.email, user.password);
    const { data: result } = await client.rpc('tx_consume_invitation', { p_token: crypto.randomUUID() });
    expect(result?.consumed).toBe(false);
    expect((await approvalOf(user.id)).approval_status).not.toBe('approved');
  });

  it('rejects a token issued for a different email', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const user = await createResident();
    users.push(user.id);
    // Token is valid, but bound to someone else's email.
    const token = await invite(`other-${Date.now()}@example.test`, apt.id);

    const client = await signedInClient(user.email, user.password);
    const { data: result } = await client.rpc('tx_consume_invitation', { p_token: token });
    expect(result?.consumed).toBe(false);
    expect((await approvalOf(user.id)).approval_status).not.toBe('approved');
  });

  it('rejects an expired invitation with the right token', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const user = await createResident();
    users.push(user.id);
    const token = await invite(user.email, apt.id, { expiresAt: new Date(Date.now() - 86_400_000).toISOString() });

    const client = await signedInClient(user.email, user.password);
    const { data: result } = await client.rpc('tx_consume_invitation', { p_token: token });
    expect(result?.consumed).toBe(false);
    expect((await approvalOf(user.id)).approval_status).not.toBe('approved');
  });

  it('rejects a missing token', async () => {
    const user = await createResident();
    users.push(user.id);
    const client = await signedInClient(user.email, user.password);
    const { data: result } = await client.rpc('tx_consume_invitation', { p_token: null });
    expect(result?.consumed).toBe(false);
  });
});
