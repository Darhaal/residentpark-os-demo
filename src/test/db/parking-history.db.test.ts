// Title: Parking Assignment History DB Test
// Path: src/test/db/parking-history.db.test.ts
// Functionality: Verifies admin-only time-machine reconstruction across assign, transfer, and revoke history.

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

interface HistoricalSpot {
  id: string;
  status: string;
  assigned_vehicle_id: string | null;
}

interface HistoricalVehicle {
  id: string;
}

interface ParkingHistoryState {
  spots: HistoricalSpot[];
  unassigned_pool: HistoricalVehicle[];
}

function parseHistoryState(data: unknown): ParkingHistoryState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid parking history result');
  const value = data as { spots?: unknown; unassigned_pool?: unknown };
  if (!Array.isArray(value.spots) || !Array.isArray(value.unassigned_pool)) {
    throw new Error('Invalid parking history collections');
  }
  return value as ParkingHistoryState;
}

describe.skipIf(!hasDbEnv())('parking assignment history', () => {
  const users: string[] = [];
  const apartments: string[] = [];
  const spots: string[] = [];

  afterEach(async () => {
    const service = serviceClient();
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

  async function createSpot(label: string) {
    const { data, error } = await serviceClient().from('parking_spots').insert({
      spot_number: `HIST-${label}-${Date.now()}`,
      status: 'available',
      created_at: '2024-12-01T00:00:00.000Z',
    }).select('id').single();
    if (error || !data) throw new Error(`spot insert: ${error?.message ?? 'no row'}`);
    spots.push(data.id as string);
    return data.id as string;
  }

  it('reconstructs assign, transfer, and revoke windows and denies resident reads', async () => {
    const apartment = await createApartment(); apartments.push(apartment.id);
    const resident = await createResident({ approve: true, apartmentId: apartment.id }); users.push(resident.id);
    const admin = await createAdmin(); users.push(admin.id);
    const adminClient = await signedInClient(admin.email, admin.password);
    const residentClient = await signedInClient(resident.email, resident.password);
    const sourceSpot = await createSpot('SOURCE');
    const targetSpot = await createSpot('TARGET');

    const { data: vehicle, error: vehicleError } = await serviceClient().from('vehicles').insert({
      apartment_id: apartment.id,
      owner_id: resident.id,
      plate_number: `HIST-${Date.now()}`,
      approval_status: 'approved',
      created_at: '2024-12-01T00:00:00.000Z',
    }).select('id').single();
    if (vehicleError || !vehicle) throw new Error(`vehicle insert: ${vehicleError?.message ?? 'no row'}`);
    const vehicleId = vehicle.id as string;

    const { error: assignError } = await adminClient.rpc('tx_assign_parking_spot', {
      p_spot_id: sourceSpot,
      p_apartment_id: apartment.id,
      p_vehicle_id: vehicleId,
      p_assignment_type: 'permanent',
      p_ends_at: null,
      p_actor_id: admin.id,
      p_payload: {},
    });
    expect(assignError).toBeNull();

    const { error: transferError } = await adminClient.rpc('tx_transfer_parking_spot', {
      p_old_spot_id: sourceSpot,
      p_new_spot_id: targetSpot,
      p_apartment_id: apartment.id,
      p_vehicle_id: vehicleId,
      p_actor_id: admin.id,
      p_payload: {},
    });
    expect(transferError).toBeNull();

    const { error: revokeError } = await adminClient.rpc('tx_revoke_parking_spot', {
      p_spot_id: targetSpot,
      p_reason: 'History boundary',
      p_actor_id: admin.id,
      p_payload: {},
    });
    expect(revokeError).toBeNull();

    const service = serviceClient();
    const { data: assignmentRows } = await service.from('parking_assignments')
      .select('id, spot_id').in('spot_id', [sourceSpot, targetSpot]);
    const sourceAssignment = assignmentRows?.find((row) => row.spot_id === sourceSpot);
    const targetAssignment = assignmentRows?.find((row) => row.spot_id === targetSpot);
    if (!sourceAssignment || !targetAssignment) throw new Error('Expected transfer history rows');

    const { error: sourceWindowError } = await service.from('parking_assignments').update({
      starts_at: '2025-01-01T00:00:00.000Z',
      ends_at: '2025-01-10T00:00:00.000Z',
    }).eq('id', sourceAssignment.id);
    const { error: targetWindowError } = await service.from('parking_assignments').update({
      starts_at: '2025-01-10T00:00:00.000Z',
      ends_at: '2025-01-20T00:00:00.000Z',
    }).eq('id', targetAssignment.id);
    expect(sourceWindowError).toBeNull();
    expect(targetWindowError).toBeNull();

    const readAt = async (timestamp: string) => {
      const { data, error } = await adminClient.rpc('get_parking_map_state', { p_target_date: timestamp });
      expect(error).toBeNull();
      return parseHistoryState(data);
    };

    const assigned = await readAt('2025-01-05T12:00:00.000Z');
    expect(assigned.spots.find((spot) => spot.id === sourceSpot)).toMatchObject({
      status: 'assigned',
      assigned_vehicle_id: vehicleId,
    });

    const transferred = await readAt('2025-01-15T12:00:00.000Z');
    expect(transferred.spots.find((spot) => spot.id === sourceSpot)?.status).toBe('available');
    expect(transferred.spots.find((spot) => spot.id === targetSpot)).toMatchObject({
      status: 'assigned',
      assigned_vehicle_id: vehicleId,
    });

    const revoked = await readAt('2025-01-25T12:00:00.000Z');
    expect(revoked.spots.find((spot) => spot.id === targetSpot)?.status).toBe('available');
    expect(revoked.unassigned_pool.some((item) => item.id === vehicleId)).toBe(true);

    const { error: residentReadError } = await residentClient.rpc('get_parking_map_state', {
      p_target_date: '2025-01-15T12:00:00.000Z',
    });
    expect(residentReadError?.message ?? '').toMatch(/FORBIDDEN|administrator/i);
  });
});
