// Title: Parking Ops DB Test
// Path: src/test/db/parking-ops.db.test.ts
// Functionality: Database authorization and RLS coverage for parking assignment operations.

// parking assignment ops are admin-only. An admin can assign a vehicle to a spot
// and revoke it; a resident cannot (tx_assign_parking_spot / tx_revoke_parking_spot).

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createAdmin, createApartment, createResident, deleteApartment, deleteUser, serviceClient, signedInClient } from './harness';

describe.skipIf(!hasDbEnv())('parking assignment ops', () => {
  const users: string[] = [];
  const apts: string[] = [];
  const spots: string[] = [];

  afterEach(async () => {
    const svc = serviceClient();
    while (spots.length) { const id = spots.pop(); if (id) await svc.from('parking_spots').delete().eq('id', id); }
    while (users.length) { const id = users.pop(); if (id) await deleteUser(id); }
    while (apts.length) { const id = apts.pop(); if (id) await deleteApartment(id); }
  });

  async function makeSpot(): Promise<string> {
    const { data, error } = await serviceClient().from('parking_spots').insert({ spot_number: `T-${Date.now()}-${spots.length}`, status: 'available' }).select('id').single();
    if (error || !data) throw new Error(`spot insert: ${error?.message ?? 'no row'}`);
    return data.id as string;
  }
  async function makeVehicle(apartmentId: string, ownerId: string): Promise<string> {
    const { data, error } = await serviceClient().from('vehicles').insert({ apartment_id: apartmentId, owner_id: ownerId, plate_number: `PK-${Date.now()}-${users.length}`, approval_status: 'approved' }).select('id').single();
    if (error || !data) throw new Error(`vehicle insert: ${error?.message ?? 'no row'}`);
    return data.id as string;
  }
  async function spotState(id: string): Promise<{ status?: string; assigned_vehicle_id?: string | null }> {
    const { data } = await serviceClient().from('parking_spots').select('status, assigned_vehicle_id').eq('id', id).single();
    return data ?? {};
  }

  it('admin assigns a vehicle to a spot, then revokes it', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id });
    users.push(resident.id);
    const admin = await createAdmin();
    users.push(admin.id);
    const spotId = await makeSpot();
    spots.push(spotId);
    const vehicleId = await makeVehicle(apt.id, resident.id);
    const client = await signedInClient(admin.email, admin.password);

    const { error: assignError } = await client.rpc('tx_assign_parking_spot', {
      p_spot_id: spotId, p_apartment_id: apt.id, p_vehicle_id: vehicleId,
      p_assignment_type: 'permanent', p_ends_at: null, p_actor_id: admin.id, p_payload: {},
    });
    expect(assignError).toBeNull();
    const assigned = await spotState(spotId);
    expect(assigned.status).toBe('assigned');
    expect(assigned.assigned_vehicle_id).toBe(vehicleId);

    const { error: revokeError } = await client.rpc('tx_revoke_parking_spot', { p_spot_id: spotId, p_reason: 'QA revoke', p_actor_id: admin.id, p_payload: {} });
    expect(revokeError).toBeNull();
    const revoked = await spotState(spotId);
    expect(revoked.status).toBe('available');
    expect(revoked.assigned_vehicle_id).toBeNull();
  });

  it('rejects manual spot statuses outside the whitelist (F1, 20260702000003)', async () => {
    const admin = await createAdmin();
    users.push(admin.id);
    const spotId = await makeSpot();
    spots.push(spotId);
    const client = await signedInClient(admin.email, admin.password);

    // Statuses owned by other flows cannot be set manually, even by an admin RPC call.
    for (const forbidden of ['assigned', 'occupied', 'conflict', 'temporary']) {
      const { error } = await client.rpc('tx_update_spot_status', {
        p_spot_id: spotId, p_new_status: forbidden, p_actor_id: admin.id, p_payload: {},
      });
      expect(error?.message ?? '').toMatch(/manual spot status/i);
    }
    expect((await spotState(spotId)).status).toBe('available');

    // The whitelisted manual statuses still work.
    const { error: reservedError } = await client.rpc('tx_update_spot_status', {
      p_spot_id: spotId, p_new_status: 'reserved', p_actor_id: admin.id, p_payload: {},
    });
    expect(reservedError).toBeNull();
    expect((await spotState(spotId)).status).toBe('reserved');

    const { error: availableError } = await client.rpc('tx_update_spot_status', {
      p_spot_id: spotId, p_new_status: 'available', p_actor_id: admin.id, p_payload: {},
    });
    expect(availableError).toBeNull();
    expect((await spotState(spotId)).status).toBe('available');
  });

  it('a resident cannot assign a parking spot', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id });
    users.push(resident.id);
    const spotId = await makeSpot();
    spots.push(spotId);
    const vehicleId = await makeVehicle(apt.id, resident.id);
    const client = await signedInClient(resident.email, resident.password);

    const { error } = await client.rpc('tx_assign_parking_spot', {
      p_spot_id: spotId, p_apartment_id: apt.id, p_vehicle_id: vehicleId,
      p_assignment_type: 'permanent', p_ends_at: null, p_actor_id: resident.id, p_payload: {},
    });
    expect(error?.message ?? '').toMatch(/FORBIDDEN|administrator/i);
  });
});
