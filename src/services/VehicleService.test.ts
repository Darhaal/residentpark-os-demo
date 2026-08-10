// Title: Vehicle Service Test
// Path: src/services/VehicleService.test.ts
// Functionality: Unit coverage for vehicle service RPC adapter contracts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { VehicleService } from './VehicleService';

const apartmentId = '11111111-1111-4111-8111-111111111111';
const ownerId = '22222222-2222-4222-8222-222222222222';
const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const vehicleId = '33333333-3333-4333-8333-333333333333';

function queryResult(result: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn().mockResolvedValue(result),
  };

  return query;
}

function supabaseWithApartment(rpc = vi.fn(), apartment = { id: apartmentId }) {
  const apartmentQuery = queryResult({ data: apartment, error: null });
  const from = vi.fn(() => apartmentQuery);
  return { supabase: { rpc, from } as unknown as SupabaseClient, from };
}

describe('VehicleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits resident vehicle requests through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const { supabase } = supabaseWithApartment(rpc);

    await expect(VehicleService.submitRequest(
      supabase,
      apartmentId,
      ownerId,
      ' abc-123 ',
      ' Toyota ',
      ' Camry ',
      ' Blue ',
      2024,
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_submit_vehicle_request', {
      p_apartment_id: apartmentId,
      p_owner_id: ownerId,
      p_actor_id: actorId,
      p_payload: {
        plate_number: 'ABC-123',
        make: 'Toyota',
        model: 'Camry',
        owner_id: ownerId,
        operation_type: 'manual',
      },
      p_plate_number: 'ABC-123',
      p_make: 'Toyota',
      p_model: 'Camry',
      p_color: 'Blue',
      p_year: 2024,
    });
  });

  it('adds admin-created vehicles through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const { supabase } = supabaseWithApartment(rpc);

    await expect(VehicleService.addByAdmin(
      supabase,
      apartmentId,
      null,
      ' ocean7 ',
      ' Tesla ',
      '',
      '',
      0,
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_add_vehicle_by_admin', {
      p_apartment_id: apartmentId,
      p_owner_id: null,
      p_actor_id: actorId,
      p_payload: {
        plate_number: 'OCEAN7',
        make: 'Tesla',
        model: null,
        owner_id: null,
        operation_type: 'manual',
      },
      p_plate_number: 'OCEAN7',
      p_make: 'Tesla',
      p_model: null,
      p_color: null,
      p_year: null,
    });
  });

  it('rejects invalid vehicle input before calling the RPC', async () => {
    const rpc = vi.fn();
    const { supabase } = supabaseWithApartment(rpc);

    await expect(VehicleService.submitRequest(
      supabase,
      apartmentId,
      ownerId,
      'A',
      'Toyota',
      'Camry',
      'Blue',
      2024,
      actorId,
    )).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Invalid plate number.',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps duplicate submit failures to a safe conflict error', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key value' } });
    const { supabase } = supabaseWithApartment(rpc);

    await expect(VehicleService.submitRequest(
      supabase,
      apartmentId,
      ownerId,
      'ABC123',
      'Toyota',
      'Camry',
      'Blue',
      2024,
      actorId,
    )).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Vehicle with this plate already exists.',
    });
  });

  it('reviews vehicles through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const vehicleQuery = queryResult({
      data: {
        plate_number: 'ABC123',
        approval_status: VEHICLE_APPROVAL_STATUS.pendingApproval,
        apartment_id: apartmentId,
      },
      error: null,
    });
    const from = vi.fn(() => vehicleQuery);
    const supabase = { rpc, from } as unknown as SupabaseClient;

    await expect(VehicleService.reviewVehicle(
      supabase,
      vehicleId,
      VEHICLE_APPROVAL_STATUS.approved,
      'Verified registration',
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_review_vehicle', {
      p_vehicle_id: vehicleId,
      p_decision: VEHICLE_APPROVAL_STATUS.approved,
      p_reason: 'Verified registration',
      p_actor_id: actorId,
      p_payload: {
        plate_number: 'ABC123',
        old_status: VEHICLE_APPROVAL_STATUS.pendingApproval,
        new_status: VEHICLE_APPROVAL_STATUS.approved,
        reason: 'Verified registration',
        operation_type: 'manual',
      },
    });
  });

  it('does not call the review RPC when the decision matches current status', async () => {
    const rpc = vi.fn();
    const vehicleQuery = queryResult({
      data: {
        plate_number: 'ABC123',
        approval_status: VEHICLE_APPROVAL_STATUS.approved,
        apartment_id: apartmentId,
      },
      error: null,
    });
    const from = vi.fn(() => vehicleQuery);
    const supabase = { rpc, from } as unknown as SupabaseClient;

    await expect(VehicleService.reviewVehicle(
      supabase,
      vehicleId,
      VEHICLE_APPROVAL_STATUS.approved,
      'Already approved',
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).not.toHaveBeenCalled();
  });

  it('bulk reviews vehicles through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = { rpc } as unknown as SupabaseClient;
    const vehicleIds = [vehicleId, '44444444-4444-4444-8444-444444444444'];

    await expect(VehicleService.bulkReviewVehicles(
      supabase,
      vehicleIds,
      VEHICLE_APPROVAL_STATUS.rejected,
      'Missing registration',
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_bulk_review_vehicles', {
      p_vehicle_ids: vehicleIds,
      p_decision: VEHICLE_APPROVAL_STATUS.rejected,
      p_reason: 'Missing registration',
      p_actor_id: actorId,
      p_payload: {
        new_status: VEHICLE_APPROVAL_STATUS.rejected,
        reason: 'Missing registration',
        operation_type: 'bulk',
      },
    });
  });

  it('does not call the database for an empty bulk vehicle review set', async () => {
    const rpc = vi.fn();
    const supabase = { rpc } as unknown as SupabaseClient;

    await expect(VehicleService.bulkReviewVehicles(
      supabase,
      [],
      VEHICLE_APPROVAL_STATUS.approved,
      'No-op',
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).not.toHaveBeenCalled();
  });

  it('archives vehicles with the default reason when none is supplied', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = { rpc } as unknown as SupabaseClient;

    await expect(VehicleService.archiveVehicle(supabase, vehicleId, '', actorId))
      .resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_archive_vehicle', {
      p_vehicle_id: vehicleId,
      p_actor_id: actorId,
      p_reason: 'Admin archived',
    });
  });
});
