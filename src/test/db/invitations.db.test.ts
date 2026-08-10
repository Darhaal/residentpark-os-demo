// Title: Invitations DB Test
// Path: src/test/db/invitations.db.test.ts
// Functionality: Database authorization and RLS coverage for invitation visibility and creation.

// invitation creation is admin-only and rejects a duplicate active invitation
// for the same email (tx_create_invitation, 0003).

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createAdmin, createApartment, createResident, deleteApartment, deleteUser, signedInClient } from './harness';

describe.skipIf(!hasDbEnv())('tx_create_invitation', () => {
  const users: string[] = [];
  const apts: string[] = [];

  afterEach(async () => {
    while (users.length) { const id = users.pop(); if (id) await deleteUser(id); }
    while (apts.length) { const id = apts.pop(); if (id) await deleteApartment(id); }
  });

  it('admin creates an invitation; a duplicate active invitation is rejected', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const admin = await createAdmin();
    users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const email = `invitee-${Date.now()}@example.test`;

    const { data: id, error } = await client.rpc('tx_create_invitation', { p_email: email, p_apartment_id: apt.id, p_expiration_days: 7 });
    expect(error).toBeNull();
    expect(id).toBeTruthy();

    const { error: dupError } = await client.rpc('tx_create_invitation', { p_email: email, p_apartment_id: apt.id, p_expiration_days: 7 });
    expect(dupError?.message ?? '').toMatch(/CONFLICT|already exists/i);
  });

  it('a resident cannot create invitations', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id });
    users.push(resident.id);
    const client = await signedInClient(resident.email, resident.password);

    const { error } = await client.rpc('tx_create_invitation', { p_email: `x-${Date.now()}@example.test`, p_apartment_id: apt.id, p_expiration_days: 7 });
    expect(error?.message ?? '').toMatch(/FORBIDDEN|administrator/i);
  });
});
