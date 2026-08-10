// Title: Apartment Manager DB Test
// Path: src/test/db/apartment-manager.db.test.ts
// Functionality: Database authorization and RLS coverage for apartment manager preservation.

// the first eligible resident becomes apartment manager, while later
// approve-and-assign and invitation-consumption flows preserve that manager.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import {
  createAdmin,
  createApartment,
  createResident,
  deleteApartment,
  deleteUser,
  serviceClient,
  signedInClient,
} from './harness';

describe.skipIf(!hasDbEnv())('apartment manager preservation', () => {
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

  async function approveAndAssign(adminEmail: string, adminPassword: string, adminId: string, userId: string, apartmentId: string) {
    const adminClient = await signedInClient(adminEmail, adminPassword);
    const { error } = await adminClient.rpc('tx_identity_approve_and_assign', {
      p_target_id: userId,
      p_apartment_id: apartmentId,
      p_reason: `manager preservation test ${adminId}`,
    });
    expect(error).toBeNull();
  }

  async function managerFlags(userIds: string[]) {
    const { data, error } = await serviceClient()
      .from('profiles')
      .select('id, is_apartment_manager, approval_status, apartment_id')
      .in('id', userIds);
    if (error || !data) throw new Error(`manager read failed: ${error?.message ?? 'no rows'}`);
    return new Map(data.map((row) => [row.id as string, row]));
  }

  async function invite(email: string, apartmentId: string): Promise<string> {
    const token = crypto.randomUUID();
    const { error } = await serviceClient().from('invitations').insert({
      email,
      role: 'resident',
      apartment_id: apartmentId,
      status: 'pending',
      token,
    });
    if (error) throw new Error(`invite insert failed: ${error.message}`);
    return token;
  }

  it('preserves the existing manager when a second resident is approved into the apartment', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const admin = await createAdmin();
    users.push(admin.id);
    const first = await createResident();
    users.push(first.id);
    const second = await createResident();
    users.push(second.id);

    await approveAndAssign(admin.email, admin.password, admin.id, first.id, apt.id);
    let flags = await managerFlags([first.id, second.id]);
    expect(flags.get(first.id)?.approval_status).toBe('approved');
    expect(flags.get(first.id)?.apartment_id).toBe(apt.id);
    expect(flags.get(first.id)?.is_apartment_manager).toBe(true);

    await approveAndAssign(admin.email, admin.password, admin.id, second.id, apt.id);
    flags = await managerFlags([first.id, second.id]);
    expect(flags.get(first.id)?.is_apartment_manager).toBe(true);
    expect(flags.get(second.id)?.approval_status).toBe('approved');
    expect(flags.get(second.id)?.apartment_id).toBe(apt.id);
    expect(flags.get(second.id)?.is_apartment_manager).toBe(false);
  });

  it('preserves the existing manager when a second resident accepts an invitation', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const admin = await createAdmin();
    users.push(admin.id);
    const first = await createResident();
    users.push(first.id);
    const invited = await createResident();
    users.push(invited.id);

    await approveAndAssign(admin.email, admin.password, admin.id, first.id, apt.id);
    const token = await invite(invited.email, apt.id);

    const invitedClient = await signedInClient(invited.email, invited.password);
    const { data: result, error } = await invitedClient.rpc('tx_consume_invitation', { p_token: token });
    expect(error).toBeNull();
    expect(result?.consumed).toBe(true);

    const flags = await managerFlags([first.id, invited.id]);
    expect(flags.get(first.id)?.is_apartment_manager).toBe(true);
    expect(flags.get(invited.id)?.approval_status).toBe('approved');
    expect(flags.get(invited.id)?.apartment_id).toBe(apt.id);
    expect(flags.get(invited.id)?.is_apartment_manager).toBe(false);
  });
});
