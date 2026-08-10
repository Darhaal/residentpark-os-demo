// Title: Parking Service Test
// Path: src/services/ParkingService.test.ts
// Functionality: Unit coverage for parking service RPC adapter contracts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PARKING_SPOT_STATUS, VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { ParkingService } from './ParkingService';

const spotId = '11111111-1111-4111-8111-111111111111';
const newSpotId = '22222222-2222-4222-8222-222222222222';
const apartmentId = '33333333-3333-4333-8333-333333333333';
const vehicleId = '44444444-4444-4444-8444-444444444444';
const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type QueryResult = { data: unknown; error: unknown };

function queryResult(result: QueryResult) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    neq: vi.fn(() => query),
    limit: vi.fn(() => query),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: <TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  };

  return query;
}

function supabaseWithFrom(from: ReturnType<typeof vi.fn>, rpc = vi.fn().mockResolvedValue({ data: null, error: null })) {
  return { supabase: { from, rpc } as unknown as SupabaseClient, rpc };
}

describe('ParkingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assigns a parking spot through the typed RPC contract', async () => {
    const apartmentQuery = queryResult({ data: { apartment_number: 'A-101' }, error: null });
    const vehicleQuery = queryResult({
      data: {
        plate_number: 'OCEAN7',
        approval_status: VEHICLE_APPROVAL_STATUS.approved,
        apartment_id: apartmentId,
      },
      error: null,
    });
    const existingVehicleSpotQuery = queryResult({ data: null, error: null });
    const spotQuery = queryResult({ data: { spot_number: 'P-01', status: PARKING_SPOT_STATUS.available }, error: null });
    const parkingSpotQueries = [existingVehicleSpotQuery, spotQuery];
    const from = vi.fn((table: string) => {
      if (table === 'apartments') return apartmentQuery;
      if (table === 'vehicles') return vehicleQuery;
      return parkingSpotQueries.shift();
    });
    const { supabase, rpc } = supabaseWithFrom(from);

    await expect(ParkingService.assignSpot(
      supabase,
      spotId,
      apartmentId,
      vehicleId,
      'resident',
      '2026-07-01T00:00:00.000Z',
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_assign_parking_spot', {
      p_spot_id: spotId,
      p_apartment_id: apartmentId,
      p_vehicle_id: vehicleId,
      p_assignment_type: 'resident',
      p_ends_at: '2026-07-01T00:00:00.000Z',
      p_actor_id: actorId,
      p_payload: {
        spot_number: 'P-01',
        apartment_number: 'A-101',
        plate_number: 'OCEAN7',
        assignment_type: 'resident',
        starts_at: expect.any(String),
        ends_at: '2026-07-01T00:00:00.000Z',
        operation_type: 'manual',
      },
    });
  });

  it('rejects unapproved vehicles before assigning a parking spot', async () => {
    const apartmentQuery = queryResult({ data: { apartment_number: 'A-101' }, error: null });
    const vehicleQuery = queryResult({
      data: {
        plate_number: 'OCEAN7',
        approval_status: VEHICLE_APPROVAL_STATUS.pendingApproval,
        apartment_id: apartmentId,
      },
      error: null,
    });
    const from = vi.fn((table: string) => (table === 'apartments' ? apartmentQuery : vehicleQuery));
    const { supabase, rpc } = supabaseWithFrom(from);

    await expect(ParkingService.assignSpot(
      supabase,
      spotId,
      apartmentId,
      vehicleId,
      'resident',
      null,
      actorId,
    )).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
      message: 'Vehicle is not approved.',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('transfers a parking spot through the typed RPC contract', async () => {
    const apartmentQuery = queryResult({ data: { apartment_number: 'A-101' }, error: null });
    const oldSpotQuery = queryResult({
      data: {
        spot_number: 'P-01',
        assigned_apartment_id: apartmentId,
        assigned_vehicle_id: vehicleId,
        status: PARKING_SPOT_STATUS.occupied,
      },
      error: null,
    });
    const newSpotQuery = queryResult({ data: { spot_number: 'P-02', status: PARKING_SPOT_STATUS.available }, error: null });
    const vehicleQuery = queryResult({
      data: {
        plate_number: 'OCEAN7',
        approval_status: VEHICLE_APPROVAL_STATUS.approved,
        apartment_id: apartmentId,
      },
      error: null,
    });
    const parkingSpotQueries = [oldSpotQuery, newSpotQuery];
    const from = vi.fn((table: string) => {
      if (table === 'apartments') return apartmentQuery;
      if (table === 'vehicles') return vehicleQuery;
      return parkingSpotQueries.shift();
    });
    const { supabase, rpc } = supabaseWithFrom(from);

    await expect(ParkingService.transferSpot(
      supabase,
      spotId,
      newSpotId,
      apartmentId,
      vehicleId,
      'Resident requested accessible spot',
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_transfer_parking_spot', {
      p_old_spot_id: spotId,
      p_new_spot_id: newSpotId,
      p_apartment_id: apartmentId,
      p_vehicle_id: vehicleId,
      p_actor_id: actorId,
      p_payload: {
        spot_from: 'P-01',
        spot_to: 'P-02',
        apartment_number: 'A-101',
        plate_number: 'OCEAN7',
        reason: 'Resident requested accessible spot',
        operation_type: 'manual',
      },
    });
  });

  it('rejects transfer requests without a detailed reason before calling the database', async () => {
    const rpc = vi.fn();
    const supabase = { rpc } as unknown as SupabaseClient;

    await expect(ParkingService.transferSpot(
      supabase,
      spotId,
      newSpotId,
      apartmentId,
      vehicleId,
      'no',
      actorId,
    )).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'A detailed operational reason is strictly required.',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('revokes active parking spots through the typed RPC contract', async () => {
    const spotQuery = queryResult({
      data: {
        spot_number: 'P-01',
        status: PARKING_SPOT_STATUS.occupied,
        assigned_apartment_id: apartmentId,
      },
      error: null,
    });
    const from = vi.fn(() => spotQuery);
    const { supabase, rpc } = supabaseWithFrom(from);

    await expect(ParkingService.revokeSpot(supabase, spotId, 'Resident moved out', actorId))
      .resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_revoke_parking_spot', {
      p_spot_id: spotId,
      p_reason: 'Resident moved out',
      p_actor_id: actorId,
      p_payload: {
        spot_number: 'P-01',
        previous_apartment_id: apartmentId,
        reason: 'Resident moved out',
        operation_type: 'manual',
      },
    });
  });

  it('does not revoke already available parking spots', async () => {
    const spotQuery = queryResult({
      data: {
        spot_number: 'P-01',
        status: PARKING_SPOT_STATUS.available,
        assigned_apartment_id: null,
      },
      error: null,
    });
    const from = vi.fn(() => spotQuery);
    const { supabase, rpc } = supabaseWithFrom(from);

    await expect(ParkingService.revokeSpot(supabase, spotId, 'No-op', actorId))
      .resolves.toBeUndefined();

    expect(rpc).not.toHaveBeenCalled();
  });

  it('updates parking spot status through the typed RPC contract', async () => {
    const spotQuery = queryResult({
      data: { spot_number: 'P-01', status: PARKING_SPOT_STATUS.available },
      error: null,
    });
    const from = vi.fn(() => spotQuery);
    const { supabase, rpc } = supabaseWithFrom(from);

    await expect(ParkingService.updateSpotStatus(
      supabase,
      spotId,
      PARKING_SPOT_STATUS.maintenance,
      'Paint work',
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_update_spot_status', {
      p_spot_id: spotId,
      p_new_status: PARKING_SPOT_STATUS.maintenance,
      p_actor_id: actorId,
      p_payload: {
        spot_number: 'P-01',
        old_status: PARKING_SPOT_STATUS.available,
        new_status: PARKING_SPOT_STATUS.maintenance,
        reason: 'Paint work',
        operation_type: 'manual',
      },
    });
  });

  it('bulk blocks and relocates through one typed RPC contract', async () => {
    const from = vi.fn();
    const rpc = vi.fn().mockResolvedValue({
      data: { blocked: 3, relocated: 2, unassigned: 1 },
      error: null,
    });
    const { supabase } = supabaseWithFrom(from, rpc);

    await expect(ParkingService.bulkBlockZones(
      supabase,
      'north',
      '2',
      'Construction staging',
      '2026-07-03',
      actorId,
    )).resolves.toEqual({ blocked: 3, relocated: 2, unassigned: 1 });

    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('tx_bulk_block_and_relocate', {
      p_zone: 'north',
      p_floor: '2',
      p_reason: 'Construction staging',
      p_blocked_until: '2026-07-03',
      p_actor_id: actorId,
      p_payload: {
        spot_number: 'BULK_ZONE',
        reason: 'Construction staging',
        blocked_until: '2026-07-03',
        operation_type: 'bulk',
      },
    });
  });

  it('rejects a malformed bulk-block RPC result', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { blocked: 3, relocated: '2', unassigned: 1 },
      error: null,
    });
    const { supabase } = supabaseWithFrom(vi.fn(), rpc);

    await expect(ParkingService.bulkBlockZones(
      supabase,
      'north',
      '2',
      'Construction staging',
      '2026-07-03',
      actorId,
    )).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Invalid bulk blocking result.',
    });
  });
});
