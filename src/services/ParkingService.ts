// Title: Parking Domain Service
// Path: src/services/ParkingService.ts
// Functionality: Typed service boundary for parking assignment, transfer, revocation, and atomic bulk blocking.

import { SupabaseClient } from '@supabase/supabase-js';
import { AppError, toDatabaseAppError } from '@/lib/errors';
import { ParkingAssignedPayload, ParkingRevokedPayload, ParkingTransferredPayload, ParkingSpotBlockedPayload, ParkingSpotUpdatedPayload } from '@/domain/contracts';
import { PARKING_SPOT_STATUS, VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { PARKING_ACTIVE_ASSIGNMENT_STATUSES, PARKING_ASSIGNABLE_STATUSES } from '@/config/parking';

export interface ParkingBulkBlockResult {
  blocked: number;
  relocated: number;
  unassigned: number;
}

function parseBulkBlockResult(value: unknown): ParkingBulkBlockResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('INTERNAL_ERROR', 'Invalid bulk blocking result.');
  }

  const result = value as Record<string, unknown>;
  for (const key of ['blocked', 'relocated', 'unassigned'] as const) {
    if (!Number.isInteger(result[key]) || (result[key] as number) < 0) {
      throw new AppError('INTERNAL_ERROR', 'Invalid bulk blocking result.');
    }
  }

  return {
    blocked: result.blocked as number,
    relocated: result.relocated as number,
    unassigned: result.unassigned as number,
  };
}

export class ParkingService {
  private static isNotFound(error: { code?: string } | null | undefined) {
    return error?.code === 'PGRST116';
  }

  static async assignSpot(supabase: SupabaseClient, spotId: string, apartmentId: string, vehicleId: string | null, assignmentType: string, endsAt: string | null, actorId: string): Promise<void> {
    const { data: apt, error: aptErr } = await supabase.from('apartments').select('apartment_number').eq('id', apartmentId).single();
    if (aptErr) {
      throw toDatabaseAppError(aptErr, {
        NOT_FOUND: 'Apartment not found.',
        INTERNAL_ERROR: 'Failed to load apartment for assignment.'
      });
    }
    if (!apt) throw new AppError('NOT_FOUND', 'Apartment not found.');

    let plateNumber = null;
    if (vehicleId) {
      const { data: vehicle, error: vehErr } = await supabase.from('vehicles').select('plate_number, approval_status, apartment_id').eq('id', vehicleId).single();
      if (vehErr) {
        throw toDatabaseAppError(vehErr, {
          NOT_FOUND: 'Vehicle not found.',
          INTERNAL_ERROR: 'Failed to load vehicle for assignment.'
        });
      }
      if (!vehicle) throw new AppError('NOT_FOUND', 'Vehicle not found.');
      if (vehicle.approval_status !== VEHICLE_APPROVAL_STATUS.approved) throw new AppError('RULE_VIOLATION', 'Vehicle is not approved.');
      if (vehicle.apartment_id !== apartmentId) throw new AppError('RULE_VIOLATION', 'Vehicle does not physically belong to the target apartment.');

      // Preserve an operator-friendly conflict before the database uniqueness guard runs.
      const { data: existingSpot, error: existingSpotErr } = await supabase.from('parking_spots').select('spot_number').eq('assigned_vehicle_id', vehicleId).maybeSingle();
      if (existingSpotErr) throw toDatabaseAppError(existingSpotErr, { INTERNAL_ERROR: 'Failed to check existing vehicle assignment.' });
      if (existingSpot) {
        throw new AppError('RULE_VIOLATION', `This vehicle is already assigned to spot ${existingSpot.spot_number}. Please use the Transfer operation instead.`);
      }

      plateNumber = vehicle.plate_number;
    }

    const { data: spot, error: spotErr } = await supabase.from('parking_spots').select('spot_number, status').eq('id', spotId).single();
    if (spotErr) {
      throw toDatabaseAppError(spotErr, {
        NOT_FOUND: 'Parking spot not found.',
        INTERNAL_ERROR: 'Failed to load parking spot for assignment.'
      });
    }
    if (!spot) throw new AppError('NOT_FOUND', 'Parking spot not found.');

    // Allow overriding 'temporary' assigned spots
    if (!PARKING_ASSIGNABLE_STATUSES.includes(spot.status as (typeof PARKING_ASSIGNABLE_STATUSES)[number])) {
      throw new AppError('CONFLICT', `Cannot assign. Spot is currently blocked or occupied (status: ${spot.status}).`);
    }

    const payload: ParkingAssignedPayload = { spot_number: spot.spot_number, apartment_number: apt.apartment_number, plate_number: plateNumber, assignment_type: assignmentType, starts_at: new Date().toISOString(), ends_at: endsAt, operation_type: 'manual' };

    const { error: txError } = await supabase.rpc('tx_assign_parking_spot', { p_spot_id: spotId, p_apartment_id: apartmentId, p_vehicle_id: vehicleId, p_assignment_type: assignmentType, p_ends_at: endsAt, p_actor_id: actorId, p_payload: payload });
    if (txError) throw toDatabaseAppError(txError, { INTERNAL_ERROR: 'Failed to assign parking spot.' });
  }

  static async transferSpot(supabase: SupabaseClient, oldSpotId: string, newSpotId: string, apartmentId: string, vehicleId: string | null, reason: string, actorId: string): Promise<void> {
    if (!reason || reason.trim().length < 3) throw new AppError('VALIDATION_ERROR', 'A detailed operational reason is strictly required.');

    const { data: apt, error: aptErr } = await supabase.from('apartments').select('apartment_number').eq('id', apartmentId).single();
    if (aptErr && !this.isNotFound(aptErr)) throw toDatabaseAppError(aptErr, { INTERNAL_ERROR: 'Failed to load target apartment.' });
    if (!apt) throw new AppError('NOT_FOUND', 'Target apartment not found.');

    const { data: oldSpot, error: oldSpotErr } = await supabase.from('parking_spots').select('spot_number, assigned_apartment_id, assigned_vehicle_id, status').eq('id', oldSpotId).single();
    if (oldSpotErr && !this.isNotFound(oldSpotErr)) throw toDatabaseAppError(oldSpotErr, { INTERNAL_ERROR: 'Failed to load source parking spot.' });
    if (!oldSpot) throw new AppError('NOT_FOUND', 'Source spot not found.');
    if (!PARKING_ACTIVE_ASSIGNMENT_STATUSES.includes(oldSpot.status as (typeof PARKING_ACTIVE_ASSIGNMENT_STATUSES)[number])) throw new AppError('RULE_VIOLATION', 'Source spot does not have an active assignment.');
    if (oldSpot.assigned_apartment_id !== apartmentId) throw new AppError('RULE_VIOLATION', 'CRITICAL: The source spot does not belong to the provided apartment.');
    if (oldSpot.assigned_vehicle_id !== vehicleId) throw new AppError('RULE_VIOLATION', 'CRITICAL: The specified vehicle is not actively assigned to the source spot.');

    const { data: newSpot, error: newSpotErr } = await supabase.from('parking_spots').select('spot_number, status').eq('id', newSpotId).single();
    if (newSpotErr && !this.isNotFound(newSpotErr)) throw toDatabaseAppError(newSpotErr, { INTERNAL_ERROR: 'Failed to load target parking spot.' });
    if (!newSpot) throw new AppError('NOT_FOUND', 'Target spot not found.');

    // Allow transferring into 'temporary' spots
    if (!PARKING_ASSIGNABLE_STATUSES.includes(newSpot.status as (typeof PARKING_ASSIGNABLE_STATUSES)[number])) {
       throw new AppError('CONFLICT', `Target spot is ${newSpot.status} and cannot receive a transfer.`);
    }

    let plateNumber = null;
    if (vehicleId) {
      const { data: vehicle, error: vehicleErr } = await supabase.from('vehicles').select('plate_number, approval_status, apartment_id').eq('id', vehicleId).single();
      if (vehicleErr && !this.isNotFound(vehicleErr)) throw toDatabaseAppError(vehicleErr, { INTERNAL_ERROR: 'Failed to load transfer vehicle.' });
      if (!vehicle) throw new AppError('NOT_FOUND', 'Vehicle not found.');
      if (vehicle.approval_status !== VEHICLE_APPROVAL_STATUS.approved) throw new AppError('RULE_VIOLATION', 'Transferred vehicle must be approved.');
      if (vehicle.apartment_id !== apartmentId) throw new AppError('RULE_VIOLATION', 'Vehicle belongs to a different apartment unit.');
      plateNumber = vehicle.plate_number;
    }

    const payload: ParkingTransferredPayload = {
      spot_from: oldSpot.spot_number,
      spot_to: newSpot.spot_number,
      apartment_number: apt.apartment_number,
      plate_number: plateNumber,
      reason: reason,
      operation_type: 'manual'
    };

    const { error: txError } = await supabase.rpc('tx_transfer_parking_spot', {
      p_old_spot_id: oldSpotId, p_new_spot_id: newSpotId, p_apartment_id: apartmentId, p_vehicle_id: vehicleId, p_actor_id: actorId, p_payload: payload
    });

    if (txError) throw toDatabaseAppError(txError, { INTERNAL_ERROR: 'Failed to transfer parking spot.' });
  }

  static async revokeSpot(supabase: SupabaseClient, spotId: string, reason: string, actorId: string): Promise<void> {
    const { data: spot, error: spotErr } = await supabase.from('parking_spots').select('spot_number, status, assigned_apartment_id').eq('id', spotId).single();
    if (spotErr && !this.isNotFound(spotErr)) throw toDatabaseAppError(spotErr, { INTERNAL_ERROR: 'Failed to load parking spot for revocation.' });
    if (!spot || spot.status === PARKING_SPOT_STATUS.available) return;
    const payload: ParkingRevokedPayload = { spot_number: spot.spot_number, previous_apartment_id: spot.assigned_apartment_id || 'Unknown', reason, operation_type: 'manual' };
    const { error: txError } = await supabase.rpc('tx_revoke_parking_spot', { p_spot_id: spotId, p_reason: reason, p_actor_id: actorId, p_payload: payload });
    if (txError) throw toDatabaseAppError(txError, { INTERNAL_ERROR: 'Failed to revoke parking spot.' });
  }

  static async updateSpotStatus(supabase: SupabaseClient, spotId: string, newStatus: string, reason: string, actorId: string): Promise<void> {
    const { data: spot, error: spotErr } = await supabase.from('parking_spots').select('spot_number, status').eq('id', spotId).single();
    if (spotErr && !this.isNotFound(spotErr)) throw toDatabaseAppError(spotErr, { INTERNAL_ERROR: 'Failed to load parking spot for status update.' });
    if (!spot || spot.status === newStatus) return;
    const payload: ParkingSpotUpdatedPayload = { spot_number: spot.spot_number, old_status: spot.status, new_status: newStatus, reason, operation_type: 'manual' };
    const { error: txError } = await supabase.rpc('tx_update_spot_status', { p_spot_id: spotId, p_new_status: newStatus, p_actor_id: actorId, p_payload: payload });
    if (txError) throw toDatabaseAppError(txError, { INTERNAL_ERROR: 'Failed to update parking spot status.' });
  }

  static async bulkBlockZones(supabase: SupabaseClient, zone: string | null, floor: string | null, reason: string, blockedUntil: string, actorId: string): Promise<ParkingBulkBlockResult> {
    const payload: ParkingSpotBlockedPayload = { spot_number: 'BULK_ZONE', reason, blocked_until: blockedUntil, operation_type: 'bulk' };
    const { data, error: blockErr } = await supabase.rpc('tx_bulk_block_and_relocate', {
      p_zone: zone,
      p_floor: floor,
      p_reason: reason,
      p_blocked_until: blockedUntil,
      p_actor_id: actorId,
      p_payload: payload,
    });
    if (blockErr) throw toDatabaseAppError(blockErr, { INTERNAL_ERROR: 'Failed to execute bulk blocking transaction.' });
    return parseBulkBlockResult(data);
  }
}
