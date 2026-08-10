// Title: Atomic Parking Bulk Block DB Test
// Path: src/test/db/parking-bulk-block.db.test.ts
// Functionality: Verifies mixed relocation/revocation results and full rollback on a mid-batch failure.

import { Client } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { dbEnv, hasDbEnv } from './env';
import {
  createAdmin,
  createApartment,
  createResident,
  deleteApartment,
  deleteUser,
  serviceClient,
  signedInClient,
} from './harness';

const FAILURE_TRIGGER = 'test_bulk_block_fail_trigger';
const FAILURE_FUNCTION = 'test_bulk_block_fail_insert';

describe.skipIf(!hasDbEnv())('atomic parking bulk block', () => {
  const users: string[] = [];
  const apartments: string[] = [];
  const spots: string[] = [];

  async function dropFailureTrigger(): Promise<void> {
    const client = new Client({ connectionString: dbEnv().databaseUrl });
    await client.connect();
    try {
      await client.query(`DROP TRIGGER IF EXISTS ${FAILURE_TRIGGER} ON public.parking_assignments`);
      await client.query(`DROP FUNCTION IF EXISTS public.${FAILURE_FUNCTION}()`);
    } finally {
      await client.end();
    }
  }

  afterEach(async () => {
    await dropFailureTrigger();
    const service = serviceClient();
    if (users.length > 0) await service.from('events').delete().in('actor_id', users);
    while (spots.length) {
      const id = spots.pop();
      if (id) await service.from('parking_spots').delete().eq('id', id);
    }
    while (users.length) {
      const id = users.pop();
      if (id) await deleteUser(id);
    }
    while (apartments.length) {
      const id = apartments.pop();
      if (id) await deleteApartment(id);
    }
  });

  async function makeSpot(zone: string, floor: string): Promise<string> {
    const { data, error } = await serviceClient().from('parking_spots').insert({
      spot_number: `BULK-${Date.now()}-${spots.length}`,
      zone,
      floor,
      status: 'available',
    }).select('id').single();
    if (error || !data) throw new Error(`spot insert: ${error?.message ?? 'no row'}`);
    const id = data.id as string;
    spots.push(id);
    return id;
  }

  async function makeVehicle(apartmentId: string, ownerId: string): Promise<string> {
    const { data, error } = await serviceClient().from('vehicles').insert({
      apartment_id: apartmentId,
      owner_id: ownerId,
      plate_number: `BULK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      approval_status: 'approved',
    }).select('id').single();
    if (error || !data) throw new Error(`vehicle insert: ${error?.message ?? 'no row'}`);
    return data.id as string;
  }

  async function setup() {
    const apartment = await createApartment();
    apartments.push(apartment.id);
    const resident = await createResident({ approve: true, apartmentId: apartment.id });
    users.push(resident.id);
    const admin = await createAdmin();
    users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    return { apartment, resident, admin, client };
  }

  async function assign(
    client: Awaited<ReturnType<typeof signedInClient>>,
    spotId: string,
    apartmentId: string,
    vehicleId: string,
    adminId: string,
  ) {
    const { error } = await client.rpc('tx_assign_parking_spot', {
      p_spot_id: spotId,
      p_apartment_id: apartmentId,
      p_vehicle_id: vehicleId,
      p_assignment_type: 'permanent',
      p_ends_at: null,
      p_actor_id: adminId,
      p_payload: {},
    });
    expect(error).toBeNull();
  }

  async function bulkBlock(
    client: Awaited<ReturnType<typeof signedInClient>>,
    zone: string,
    floor: string,
    adminId: string,
  ) {
    return client.rpc('tx_bulk_block_and_relocate', {
      p_zone: zone,
      p_floor: floor,
      p_reason: 'Garage resurfacing',
      p_blocked_until: '2026-07-15',
      p_actor_id: adminId,
      p_payload: {},
    });
  }

  async function installFailureTrigger(targetSpotId: string): Promise<void> {
    const client = new Client({ connectionString: dbEnv().databaseUrl });
    await client.connect();
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION public.${FAILURE_FUNCTION}()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          IF NEW.spot_id = '${targetSpotId}'::uuid THEN
            RAISE EXCEPTION 'forced bulk block failure';
          END IF;
          RETURN NEW;
        END;
        $$
      `);
      await client.query(`
        CREATE TRIGGER ${FAILURE_TRIGGER}
        BEFORE INSERT ON public.parking_assignments
        FOR EACH ROW EXECUTE FUNCTION public.${FAILURE_FUNCTION}()
      `);
    } finally {
      await client.end();
    }
  }

  it('relocates what it can, revokes the remainder, and blocks every selected spot', async () => {
    const { apartment, resident, admin, client } = await setup();
    const zone = `closure-${Date.now()}`;
    const floor = 'B1';
    const sourceOne = await makeSpot(zone, floor);
    const sourceTwo = await makeSpot(zone, floor);
    const freeAffected = await makeSpot(zone, floor);
    const relocationTarget = await makeSpot('relocation', floor);
    const vehicleOne = await makeVehicle(apartment.id, resident.id);
    const vehicleTwo = await makeVehicle(apartment.id, resident.id);
    await assign(client, sourceOne, apartment.id, vehicleOne, admin.id);
    await assign(client, sourceTwo, apartment.id, vehicleTwo, admin.id);

    const { data, error } = await bulkBlock(client, zone, floor, admin.id);
    expect(error).toBeNull();
    expect(data).toEqual({ blocked: 3, relocated: 1, unassigned: 1 });

    const service = serviceClient();
    const { data: sourceRows } = await service.from('parking_spots')
      .select('id, status, assigned_apartment_id, assigned_vehicle_id')
      .in('id', [sourceOne, sourceTwo, freeAffected]);
    expect(sourceRows).toHaveLength(3);
    expect(sourceRows?.every((spot) => (
      spot.status === 'blocked'
      && spot.assigned_apartment_id === null
      && spot.assigned_vehicle_id === null
    ))).toBe(true);

    const { data: targetRow } = await service.from('parking_spots')
      .select('status, assigned_apartment_id, assigned_vehicle_id')
      .eq('id', relocationTarget)
      .single();
    expect(targetRow).toMatchObject({ status: 'assigned', assigned_apartment_id: apartment.id });
    expect([vehicleOne, vehicleTwo]).toContain(targetRow?.assigned_vehicle_id);

    const { data: sourceHistory } = await service.from('parking_assignments')
      .select('status')
      .in('spot_id', [sourceOne, sourceTwo]);
    expect(sourceHistory?.map((row) => row.status).sort()).toEqual(['revoked', 'transferred']);

    const { data: targetHistory } = await service.from('parking_assignments')
      .select('status')
      .eq('spot_id', relocationTarget)
      .eq('status', 'active');
    expect(targetHistory).toHaveLength(1);
  });

  it('rolls back earlier relocations when a later assignment insert fails', async () => {
    const { apartment, resident, admin, client } = await setup();
    const zone = `rollback-${Date.now()}`;
    const floor = 'B2';
    const sourceOne = await makeSpot(zone, floor);
    const sourceTwo = await makeSpot(zone, floor);
    const targetOne = await makeSpot('relocation', floor);
    const targetTwo = await makeSpot('relocation', floor);
    const vehicleOne = await makeVehicle(apartment.id, resident.id);
    const vehicleTwo = await makeVehicle(apartment.id, resident.id);
    await assign(client, sourceOne, apartment.id, vehicleOne, admin.id);
    await assign(client, sourceTwo, apartment.id, vehicleTwo, admin.id);

    const secondTarget = [targetOne, targetTwo].sort()[1];
    await installFailureTrigger(secondTarget);
    const { error } = await bulkBlock(client, zone, floor, admin.id);
    expect(error?.message ?? '').toMatch(/forced bulk block failure/i);

    const service = serviceClient();
    const { data: sourceRows } = await service.from('parking_spots')
      .select('status, assigned_vehicle_id')
      .in('id', [sourceOne, sourceTwo]);
    expect(sourceRows).toHaveLength(2);
    expect(sourceRows?.every((spot) => spot.status === 'assigned')).toBe(true);
    expect(sourceRows?.map((spot) => spot.assigned_vehicle_id).sort()).toEqual([vehicleOne, vehicleTwo].sort());

    const { data: targetRows } = await service.from('parking_spots')
      .select('status, assigned_vehicle_id')
      .in('id', [targetOne, targetTwo]);
    expect(targetRows).toHaveLength(2);
    expect(targetRows?.every((spot) => spot.status === 'available' && spot.assigned_vehicle_id === null)).toBe(true);

    const { data: activeAssignments } = await service.from('parking_assignments')
      .select('spot_id, vehicle_id')
      .eq('status', 'active');
    expect(activeAssignments).toEqual(expect.arrayContaining([
      expect.objectContaining({ spot_id: sourceOne, vehicle_id: vehicleOne }),
      expect.objectContaining({ spot_id: sourceTwo, vehicle_id: vehicleTwo }),
    ]));
    expect(activeAssignments?.some((row) => [targetOne, targetTwo].includes(row.spot_id))).toBe(false);

    const { data: blockEvents } = await service.from('events')
      .select('id')
      .eq('actor_id', admin.id)
      .eq('action_type', 'PARKING_SPOT_BLOCKED');
    expect(blockEvents).toHaveLength(0);
  });
});
