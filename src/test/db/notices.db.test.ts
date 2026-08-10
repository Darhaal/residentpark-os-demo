// Title: Notices DB Test
// Path: src/test/db/notices.db.test.ts
// Functionality: Database authorization and RLS coverage for notices and publication state.

// sending notices is admin-only and respects the audience: an audience='profile'
// notice reaches only the targeted resident (tx_send_notice).

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createAdmin, createApartment, createResident, deleteApartment, deleteUser, serviceClient, signedInClient } from './harness';

describe.skipIf(!hasDbEnv())('tx_send_notice audience', () => {
  const users: string[] = [];
  const apts: string[] = [];

  afterEach(async () => {
    while (users.length) { const id = users.pop(); if (id) await deleteUser(id); }
    while (apts.length) { const id = apts.pop(); if (id) await deleteApartment(id); }
  });

  async function noticeCount(recipientId: string): Promise<number> {
    const { count } = await serviceClient().from('notices').select('id', { count: 'exact', head: true }).eq('recipient_id', recipientId);
    return count ?? 0;
  }

  it('audience=profile delivers only to the targeted resident', async () => {
    const aptA = await createApartment();
    apts.push(aptA.id);
    const aptB = await createApartment();
    apts.push(aptB.id);
    const alice = await createResident({ approve: true, apartmentId: aptA.id });
    users.push(alice.id);
    const bob = await createResident({ approve: true, apartmentId: aptB.id });
    users.push(bob.id);
    const admin = await createAdmin();
    users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);

    const { data, error } = await client.rpc('tx_send_notice', {
      p_audience: 'profile', p_apartment_id: null, p_target_id: alice.id,
      p_title: 'Hi Alice', p_body: 'Personal notice', p_type: 'announcement',
    });
    expect(error).toBeNull();
    expect(data?.count).toBe(1);
    expect(await noticeCount(alice.id)).toBe(1);
    expect(await noticeCount(bob.id)).toBe(0);
  });

  it('a resident cannot send notices', async () => {
    const resident = await createResident({ approve: true });
    users.push(resident.id);
    const client = await signedInClient(resident.email, resident.password);

    const { error } = await client.rpc('tx_send_notice', { p_audience: 'all', p_apartment_id: null, p_target_id: null, p_title: 'x', p_body: 'y', p_type: 'announcement' });
    expect(error?.message ?? '').toMatch(/FORBIDDEN|administrator/i);
  });
});
