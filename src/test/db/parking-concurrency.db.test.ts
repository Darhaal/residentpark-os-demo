// Title: Parking Assignment Concurrency DB Test
// Path: src/test/db/parking-concurrency.db.test.ts
// Functionality: Concurrency coverage for parking assignment hardening (0020 + 0021).

// two simultaneous assigns to the same spot must not double-book it. The FOR UPDATE
// spot lock serializes them and the partial unique index / status check rejects the loser,
// so exactly one succeeds and the spot ends with exactly one active assignment.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createAdmin, createApartment, createResident, deleteApartment, deleteUser, serviceClient, signedInClient } from './harness';

describe.skipIf(!hasDbEnv())('parking assignment concurrency (0020/0021)', () => {
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
    const { data, error } = await serviceClient().from('parking_spots')
      .insert({ spot_number: `CC-${Date.now()}-${spots.length}`, status: 'available' }).select('id').single();
    if (error || !data) throw new Error(`spot insert: ${error?.message ?? 'no row'}`);
    return data.id as string;
  }
  async function makeVehicle(apartmentId: string, ownerId: string): Promise<string> {
    const { data, error } = await serviceClient().from('vehicles')
      .insert({ apartment_id: apartmentId, owner_id: ownerId, plate_number: `CC-${Date.now()}-${users.length}-${Math.random().toString(36).slice(2, 6)}`, approval_status: 'approved' })
      .select('id').single();
    if (error || !data) throw new Error(`vehicle insert: ${error?.message ?? 'no row'}`);
    return data.id as string;
  }

  it('two concurrent assigns to the same spot resolve to exactly one active assignment', async () => {
    const apt = await createApartment(); apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id }); users.push(resident.id);
    const admin = await createAdmin(); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const spot = await makeSpot(); spots.push(spot);
    const v1 = await makeVehicle(apt.id, resident.id);
    const v2 = await makeVehicle(apt.id, resident.id);

    const assign = (vehicleId: string) => client.rpc('tx_assign_parking_spot', {
      p_spot_id: spot, p_apartment_id: apt.id, p_vehicle_id: vehicleId,
      p_assignment_type: 'permanent', p_ends_at: null, p_actor_id: admin.id, p_payload: {},
    });

    const [r1, r2] = await Promise.all([assign(v1), assign(v2)]);

    // Exactly one of the concurrent assigns succeeds; the other is rejected.
    const failures = [r1.error, r2.error].filter(Boolean);
    expect(failures.length).toBe(1);

    const { data: active } = await serviceClient()
      .from('parking_assignments')
      .select('id')
      .eq('spot_id', spot)
      .eq('status', 'active');
    expect(active?.length).toBe(1);
  });

  it('two concurrent transfers into the same spot resolve to exactly one winner', async () => {
    const apt = await createApartment(); apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id }); users.push(resident.id);
    const admin = await createAdmin(); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const src1 = await makeSpot(); spots.push(src1);
    const src2 = await makeSpot(); spots.push(src2);
    const target = await makeSpot(); spots.push(target);
    const v1 = await makeVehicle(apt.id, resident.id);
    const v2 = await makeVehicle(apt.id, resident.id);

    const assign = (spotId: string, vehicleId: string) => client.rpc('tx_assign_parking_spot', {
      p_spot_id: spotId, p_apartment_id: apt.id, p_vehicle_id: vehicleId,
      p_assignment_type: 'permanent', p_ends_at: null, p_actor_id: admin.id, p_payload: {},
    });
    // Seed: each vehicle on its own source spot.
    expect((await assign(src1, v1)).error).toBeNull();
    expect((await assign(src2, v2)).error).toBeNull();

    const transfer = (oldSpot: string, vehicleId: string) => client.rpc('tx_transfer_parking_spot', {
      p_old_spot_id: oldSpot, p_new_spot_id: target, p_apartment_id: apt.id, p_vehicle_id: vehicleId,
      p_actor_id: admin.id, p_payload: {},
    });

    const [r1, r2] = await Promise.all([transfer(src1, v1), transfer(src2, v2)]);
    const failures = [r1.error, r2.error].filter(Boolean);
    expect(failures.length).toBe(1);

    const { data: active } = await serviceClient()
      .from('parking_assignments')
      .select('id')
      .eq('spot_id', target)
      .eq('status', 'active');
    expect(active?.length).toBe(1);
  });

  it('concurrent assign and block leave the spot internally consistent (0026)', async () => {
    const apt = await createApartment(); apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id }); users.push(resident.id);
    const admin = await createAdmin(); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const spot = await makeSpot(); spots.push(spot);
    const vehicle = await makeVehicle(apt.id, resident.id);

    const assign = client.rpc('tx_assign_parking_spot', {
      p_spot_id: spot, p_apartment_id: apt.id, p_vehicle_id: vehicle,
      p_assignment_type: 'permanent', p_ends_at: null, p_actor_id: admin.id, p_payload: {},
    });
    const block = client.rpc('tx_update_spot_status', {
      p_spot_id: spot, p_new_status: 'blocked', p_actor_id: admin.id, p_payload: {},
    });
    await Promise.all([assign, block]);

    // Whichever order the FOR UPDATE lock grants, the final state must be consistent:
    // an 'assigned' spot has exactly one active assignment; otherwise none.
    const { data: spotRow } = await serviceClient().from('parking_spots').select('status').eq('id', spot).single();
    const { data: active } = await serviceClient()
      .from('parking_assignments').select('id').eq('spot_id', spot).eq('status', 'active');
    const activeCount = active?.length ?? 0;
    if (spotRow?.status === 'assigned') {
      expect(activeCount).toBe(1);
    } else {
      expect(activeCount).toBe(0);
    }
  });
});
