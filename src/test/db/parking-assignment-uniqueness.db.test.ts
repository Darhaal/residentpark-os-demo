// Title: Parking Assignment Uniqueness DB Test
// Path: src/test/db/parking-assignment-uniqueness.db.test.ts
// Functionality: Database coverage for one-active-assignment-per-spot/vehicle (0020).

// partial unique indexes + hardened tx_assign_parking_spot make double-assignment
// structurally impossible: a spot or a vehicle can hold at most one active assignment.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createAdmin, createApartment, createResident, deleteApartment, deleteUser, serviceClient, signedInClient } from './harness';

describe.skipIf(!hasDbEnv())('parking assignment uniqueness (0020)', () => {
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
      .insert({ spot_number: `UQ-${Date.now()}-${spots.length}`, status: 'available' }).select('id').single();
    if (error || !data) throw new Error(`spot insert: ${error?.message ?? 'no row'}`);
    return data.id as string;
  }
  async function makeVehicle(apartmentId: string, ownerId: string): Promise<string> {
    const { data, error } = await serviceClient().from('vehicles')
      .insert({ apartment_id: apartmentId, owner_id: ownerId, plate_number: `UQ-${Date.now()}-${users.length}`, approval_status: 'approved' })
      .select('id').single();
    if (error || !data) throw new Error(`vehicle insert: ${error?.message ?? 'no row'}`);
    return data.id as string;
  }

  async function setup() {
    const apt = await createApartment();
    apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id });
    users.push(resident.id);
    const admin = await createAdmin();
    users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    return { apt, resident, admin, client };
  }

  function assign(client: Awaited<ReturnType<typeof signedInClient>>, spotId: string, apartmentId: string, vehicleId: string, adminId: string) {
    return client.rpc('tx_assign_parking_spot', {
      p_spot_id: spotId, p_apartment_id: apartmentId, p_vehicle_id: vehicleId,
      p_assignment_type: 'permanent', p_ends_at: null, p_actor_id: adminId, p_payload: {},
    });
  }

  it('rejects a second active assignment for the same spot', async () => {
    const { apt, resident, admin, client } = await setup();
    const spot = await makeSpot(); spots.push(spot);
    const v1 = await makeVehicle(apt.id, resident.id);
    const v2 = await makeVehicle(apt.id, resident.id);

    expect((await assign(client, spot, apt.id, v1, admin.id)).error).toBeNull();
    const { error } = await assign(client, spot, apt.id, v2, admin.id);
    // After 0021 the spot is 'assigned', so the not-assignable status check rejects the
    // second assign first; either guard (status or active-assignment) is a valid rejection.
    expect(error?.message ?? '').toMatch(/already has an active assignment|not assignable/i);
  });

  it('rejects assigning the same vehicle to a second spot', async () => {
    const { apt, resident, admin, client } = await setup();
    const spot1 = await makeSpot(); spots.push(spot1);
    const spot2 = await makeSpot(); spots.push(spot2);
    const vehicle = await makeVehicle(apt.id, resident.id);

    expect((await assign(client, spot1, apt.id, vehicle, admin.id)).error).toBeNull();
    const { error } = await assign(client, spot2, apt.id, vehicle, admin.id);
    expect(error?.message ?? '').toMatch(/vehicle already has an active assignment/i);
  });

  it('enforces the partial unique index against a direct duplicate insert', async () => {
    const { apt, resident, admin, client } = await setup();
    const spot = await makeSpot(); spots.push(spot);
    const vehicle = await makeVehicle(apt.id, resident.id);
    expect((await assign(client, spot, apt.id, vehicle, admin.id)).error).toBeNull();

    // Bypass the RPC guards with the service role: the index itself must still reject it.
    const { error } = await serviceClient().from('parking_assignments').insert({
      spot_id: spot, apartment_id: apt.id, vehicle_id: vehicle, assignment_type: 'permanent', status: 'active',
    });
    expect(error).not.toBeNull();
  });
});
