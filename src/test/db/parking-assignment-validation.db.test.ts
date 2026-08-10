// Title: Parking Assignment Validation DB Test
// Path: src/test/db/parking-assignment-validation.db.test.ts
// Functionality: Covers assign/transfer validation, including forward source-ownership hardening.

// tx_assign_parking_spot enforces the same rules as ParkingService: the spot must
// be assignable (available | temporary), and a given vehicle must be approved and belong
// to the target apartment. A direct RPC call cannot bypass these.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createAdmin, createApartment, createResident, deleteApartment, deleteUser, serviceClient, signedInClient } from './harness';

describe.skipIf(!hasDbEnv())('parking assignment validation', () => {
  const users: string[] = [];
  const apts: string[] = [];
  const spots: string[] = [];

  afterEach(async () => {
    const svc = serviceClient();
    while (spots.length) { const id = spots.pop(); if (id) await svc.from('parking_spots').delete().eq('id', id); }
    while (users.length) { const id = users.pop(); if (id) await deleteUser(id); }
    while (apts.length) { const id = apts.pop(); if (id) await deleteApartment(id); }
  });

  async function makeSpot(status = 'available'): Promise<string> {
    const { data, error } = await serviceClient().from('parking_spots')
      .insert({ spot_number: `VAL-${Date.now()}-${spots.length}`, status }).select('id').single();
    if (error || !data) throw new Error(`spot insert: ${error?.message ?? 'no row'}`);
    return data.id as string;
  }
  async function makeVehicle(apartmentId: string, ownerId: string, approval = 'approved'): Promise<string> {
    const { data, error } = await serviceClient().from('vehicles')
      .insert({ apartment_id: apartmentId, owner_id: ownerId, plate_number: `VAL-${Date.now()}-${users.length}-${Math.random().toString(36).slice(2, 6)}`, approval_status: approval })
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

  function transfer(
    client: Awaited<ReturnType<typeof signedInClient>>,
    oldSpotId: string,
    newSpotId: string,
    apartmentId: string,
    vehicleId: string,
    adminId: string,
  ) {
    return client.rpc('tx_transfer_parking_spot', {
      p_old_spot_id: oldSpotId,
      p_new_spot_id: newSpotId,
      p_apartment_id: apartmentId,
      p_vehicle_id: vehicleId,
      p_actor_id: adminId,
      p_payload: {},
    });
  }

  it('rejects an unapproved vehicle', async () => {
    const { apt, resident, admin, client } = await setup();
    const spot = await makeSpot(); spots.push(spot);
    const vehicle = await makeVehicle(apt.id, resident.id, 'pending_approval');
    const { error } = await assign(client, spot, apt.id, vehicle, admin.id);
    expect(error?.message ?? '').toMatch(/not approved/i);
  });

  it('rejects a vehicle that belongs to a different apartment', async () => {
    const { apt, resident, admin, client } = await setup();
    const otherApt = await createApartment(); apts.push(otherApt.id);
    const spot = await makeSpot(); spots.push(spot);
    const vehicle = await makeVehicle(otherApt.id, resident.id, 'approved');
    const { error } = await assign(client, spot, apt.id, vehicle, admin.id);
    expect(error?.message ?? '').toMatch(/does not belong/i);
  });

  it('rejects assigning to a blocked spot', async () => {
    const { apt, resident, admin, client } = await setup();
    const spot = await makeSpot('blocked'); spots.push(spot);
    const vehicle = await makeVehicle(apt.id, resident.id, 'approved');
    const { error } = await assign(client, spot, apt.id, vehicle, admin.id);
    expect(error?.message ?? '').toMatch(/not assignable/i);
  });

  it('cannot transfer from a source assignment owned by another apartment', async () => {
    const { apt, resident, admin, client } = await setup();
    const otherApt = await createApartment(); apts.push(otherApt.id);
    const otherResident = await createResident({ approve: true, apartmentId: otherApt.id }); users.push(otherResident.id);
    const source = await makeSpot(); spots.push(source);
    const target = await makeSpot(); spots.push(target);
    const sourceVehicle = await makeVehicle(apt.id, resident.id);
    const otherVehicle = await makeVehicle(otherApt.id, otherResident.id);

    expect((await assign(client, source, apt.id, sourceVehicle, admin.id)).error).toBeNull();
    const { error } = await transfer(client, source, target, otherApt.id, otherVehicle, admin.id);
    expect(error?.message ?? '').toMatch(/source assignment belongs to a different apartment/i);

    const { data: sourceState } = await serviceClient().from('parking_spots')
      .select('status, assigned_vehicle_id').eq('id', source).single();
    const { data: targetState } = await serviceClient().from('parking_spots')
      .select('status, assigned_vehicle_id').eq('id', target).single();
    expect(sourceState).toMatchObject({ status: 'assigned', assigned_vehicle_id: sourceVehicle });
    expect(targetState).toMatchObject({ status: 'available', assigned_vehicle_id: null });
  });

  it('cannot replace the vehicle attached to a transfer source', async () => {
    const { apt, resident, admin, client } = await setup();
    const source = await makeSpot(); spots.push(source);
    const target = await makeSpot(); spots.push(target);
    const sourceVehicle = await makeVehicle(apt.id, resident.id);
    const replacementVehicle = await makeVehicle(apt.id, resident.id);

    expect((await assign(client, source, apt.id, sourceVehicle, admin.id)).error).toBeNull();
    const { error } = await transfer(client, source, target, apt.id, replacementVehicle, admin.id);
    expect(error?.message ?? '').toMatch(/source assignment belongs to a different vehicle/i);

    const { data: activeAssignments } = await serviceClient().from('parking_assignments')
      .select('spot_id, vehicle_id').eq('status', 'active');
    expect(activeAssignments).toEqual(expect.arrayContaining([
      expect.objectContaining({ spot_id: source, vehicle_id: sourceVehicle }),
    ]));
    expect(activeAssignments).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ spot_id: target, vehicle_id: replacementVehicle }),
    ]));
  });
});
