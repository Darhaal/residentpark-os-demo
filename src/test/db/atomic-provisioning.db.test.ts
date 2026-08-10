// Title: Atomic Acceptance Provisioning DB Test
// Path: src/test/db/atomic-provisioning.db.test.ts
// Functionality: Database coverage for acceptance-aware admin provisioning (0018).

// tx_provision_pending_account + tx_finalize_pending_account: an admin provisions
// a resident PENDING with an intended apartment recorded (not occupied); the apartment is
// occupied + the account approved exactly once when the resident accepts. Non-admins
// cannot provision, and finalize only acts on the caller's own pending assignment.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import {
  createAdmin, createApartment, createResident,
  deleteApartment, deleteUser, serviceClient, signedInClient,
} from './harness';

interface ProfileState {
  approval_status?: string;
  apartment_id?: string | null;
  pending_apartment_id?: string | null;
  role?: string;
}

async function profileOf(userId: string): Promise<ProfileState> {
  const { data } = await serviceClient()
    .from('profiles')
    .select('approval_status, apartment_id, pending_apartment_id, role')
    .eq('id', userId)
    .single();
  return data ?? {};
}

describe.skipIf(!hasDbEnv())('atomic acceptance provisioning (0018)', () => {
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

  it('admin provisions a resident PENDING with the apartment recorded but not occupied', async () => {
    const admin = await createAdmin();
    users.push(admin.id);
    const target = await createResident();
    users.push(target.id);
    const apt = await createApartment();
    apts.push(apt.id);

    const adminClient = await signedInClient(admin.email, admin.password);
    const { error } = await adminClient.rpc('tx_provision_pending_account', {
      p_target_id: target.id,
      p_role: 'resident',
      p_apartment_id: apt.id,
      p_actor_id: admin.id,
    });
    expect(error).toBeNull();

    const after = await profileOf(target.id);
    expect(after.approval_status).toBe('pending_approval');
    expect(after.apartment_id ?? null).toBeNull(); // not occupied yet
    expect(after.pending_apartment_id).toBe(apt.id);
  });

  it('resident finalizes their own acceptance → approved + apartment occupied exactly once', async () => {
    const admin = await createAdmin();
    users.push(admin.id);
    const target = await createResident();
    users.push(target.id);
    const apt = await createApartment();
    apts.push(apt.id);

    const adminClient = await signedInClient(admin.email, admin.password);
    await adminClient.rpc('tx_provision_pending_account', {
      p_target_id: target.id, p_role: 'resident', p_apartment_id: apt.id, p_actor_id: admin.id,
    });

    const targetClient = await signedInClient(target.email, target.password);
    const { data: result, error } = await targetClient.rpc('tx_finalize_pending_account');
    expect(error).toBeNull();
    expect(result?.finalized).toBe(true);
    expect(result?.apartment_number).toBe(apt.number);

    const after = await profileOf(target.id);
    expect(after.approval_status).toBe('approved');
    expect(after.apartment_id).toBe(apt.id);
    expect(after.pending_apartment_id ?? null).toBeNull();

    // Idempotent: a second finalize is a no-op (already approved + assigned).
    const { data: again } = await targetClient.rpc('tx_finalize_pending_account');
    expect(again?.finalized).toBe(false);
  });

  it('a non-admin cannot provision an account', async () => {
    const caller = await createResident({ approve: true });
    users.push(caller.id);
    const target = await createResident();
    users.push(target.id);
    const apt = await createApartment();
    apts.push(apt.id);

    const callerClient = await signedInClient(caller.email, caller.password);
    const { error } = await callerClient.rpc('tx_provision_pending_account', {
      p_target_id: target.id, p_role: 'resident', p_apartment_id: apt.id, p_actor_id: caller.id,
    });
    expect(error).not.toBeNull();
    expect((await profileOf(target.id)).pending_apartment_id ?? null).toBeNull();
  });

  it('finalize is a no-op for a pending resident with no recorded apartment', async () => {
    const target = await createResident(); // pending, no pending_apartment_id
    users.push(target.id);

    const targetClient = await signedInClient(target.email, target.password);
    const { data: result } = await targetClient.rpc('tx_finalize_pending_account');
    expect(result?.finalized).toBe(false);
    expect((await profileOf(target.id)).approval_status).not.toBe('approved');
  });

  it('provisioning refuses an already-approved/occupied account', async () => {
    const admin = await createAdmin();
    users.push(admin.id);
    const apt = await createApartment();
    apts.push(apt.id);
    const target = await createResident({ approve: true, apartmentId: apt.id });
    users.push(target.id);

    const adminClient = await signedInClient(admin.email, admin.password);
    const { error } = await adminClient.rpc('tx_provision_pending_account', {
      p_target_id: target.id, p_role: 'resident', p_apartment_id: apt.id, p_actor_id: admin.id,
    });
    expect(error).not.toBeNull();
  });
});
