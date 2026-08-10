// Title: Account-Status Authorization DB Test
// Path: src/test/db/account-status-rls.db.test.ts
// Functionality: RLS coverage for account-status authorization — a deactivated resident
//   loses every apartment/vehicle/spot read, and a deactivated admin loses every
//   privileged read plus admin RPC access. Approved accounts keep working.

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

async function setStatus(userId: string, status: string): Promise<void> {
  const { error } = await serviceClient().from('profiles').update({ approval_status: status }).eq('id', userId);
  if (error) throw new Error(`setStatus failed: ${error.message}`);
}

describe.skipIf(!hasDbEnv())('account-status authorization', () => {
  const users: string[] = [];
  const apts: string[] = [];
  const spots: string[] = [];
  const vehicles: string[] = [];

  afterEach(async () => {
    for (const id of spots.splice(0)) await serviceClient().from('parking_spots').delete().eq('id', id);
    for (const id of vehicles.splice(0)) await serviceClient().from('vehicles').delete().eq('id', id);
    while (users.length) { const id = users.pop(); if (id) await deleteUser(id); }
    while (apts.length) { const id = apts.pop(); if (id) await deleteApartment(id); }
  });

  it('only an approved resident can read their apartment, vehicles and spots', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id });
    users.push(resident.id);

    const svc = serviceClient();
    const { data: veh, error: vErr } = await svc
      .from('vehicles')
      .insert({ apartment_id: apt.id, owner_id: resident.id, plate_number: `RLS-${Date.now()}`, approval_status: 'approved' })
      .select('id')
      .single();
    if (vErr || !veh) throw new Error(`seed vehicle failed: ${vErr?.message ?? 'no row'}`);
    vehicles.push(veh.id as string);

    const { data: spot, error: sErr } = await svc
      .from('parking_spots')
      .insert({ spot_number: `S-${Date.now()}`, assigned_apartment_id: apt.id, status: 'assigned' })
      .select('id')
      .single();
    if (sErr || !spot) throw new Error(`seed spot failed: ${sErr?.message ?? 'no row'}`);
    spots.push(spot.id as string);

    const client = await signedInClient(resident.email, resident.password);
    const read = async () => {
      const [a, v, s] = await Promise.all([
        client.from('apartments').select('id'),
        client.from('vehicles').select('id'),
        client.from('parking_spots').select('id'),
      ]);
      return { apartments: a.data?.length ?? 0, vehicles: v.data?.length ?? 0, spots: s.data?.length ?? 0 };
    };

    // Approved: reads exactly their own apartment row and its vehicle + spot.
    expect(await read()).toEqual({ apartments: 1, vehicles: 1, spots: 1 });

    // Deactivated in every shape → no apartment/vehicle/spot rows are visible.
    for (const status of ['suspended', 'rejected', 'pending_approval']) {
      await setStatus(resident.id, status);
      expect(await read()).toEqual({ apartments: 0, vehicles: 0, spots: 0 });
    }
  });

  it('a deactivated admin loses privileged reads and admin RPC access', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const admin = await createAdmin();
    users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);

    const apartmentsCount = async () => (await client.from('apartments').select('id')).data?.length ?? 0;

    // Approved admin sees the whole directory.
    expect(await apartmentsCount()).toBeGreaterThan(0);

    // Suspend → every admin read path (gated on get_auth_role / approval) closes.
    await setStatus(admin.id, 'suspended');
    expect(await apartmentsCount()).toBe(0);

    // is_admin() also denies the suspended admin at the RPC layer.
    const { error } = await client.rpc('tx_update_portal_notice', { p_notice: 'blocked', p_actor: admin.id });
    expect(error).not.toBeNull();
  });
});
