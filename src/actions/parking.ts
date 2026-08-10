// Title: Parking Server Actions
// Path: src/actions/parking.ts
// Functionality: Secure backend logic for Vehicles and Parking.
//
// Every action authorizes via the shared requireAdmin() guard, and responses go through
// toActionError() so raw RPC/DB text never reaches the client.

'use server';

import { ParkingService } from '@/services/ParkingService';
import { VehicleService } from '@/services/VehicleService';
import { AppError, toActionError } from '@/lib/errors';
import { logActionError } from '@/lib/action-logger';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/auth';
import { VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { BULK_ACTION_LIMITS } from '@/config/limits';
import { PARKING_MANUAL_STATUS_OPTIONS } from '@/config/parking';
import { validateUuid, validateUuidList } from '@/lib/action-validation';

type VehicleReviewDecision = typeof VEHICLE_APPROVAL_STATUS.approved | typeof VEHICLE_APPROVAL_STATUS.rejected;

export async function submitVehicleRequestAction(data: { apartmentId: string, ownerId: string | null, plateNumber: string, make: string, model: string, color: string, year: number }) {
  try {
    const { supabase, userId } = await requireAdmin();
    await VehicleService.submitRequest(
      supabase,
      validateUuid(data.apartmentId, 'apartment ID'),
      data.ownerId ? validateUuid(data.ownerId, 'owner ID') : null,
      data.plateNumber,
      data.make,
      data.model,
      data.color,
      data.year,
      userId
    );
    return { success: true as const };
  } catch (err) {
    await logActionError('submitVehicleRequestAction failed', err);
    return toActionError(err);
  }
}

export async function addVehicleByAdminAction(data: { apartmentId: string, ownerId: string | null, plateNumber: string, make: string, model: string, color: string, year: number }) {
  try {
    const { supabase, userId } = await requireAdmin();
    await VehicleService.addByAdmin(
      supabase,
      validateUuid(data.apartmentId, 'apartment ID'),
      data.ownerId ? validateUuid(data.ownerId, 'owner ID') : null,
      data.plateNumber,
      data.make,
      data.model,
      data.color,
      data.year,
      userId
    );
    return { success: true as const };
  } catch (err) {
    await logActionError('addVehicleByAdminAction failed', err);
    return toActionError(err);
  }
}

export async function bulkReviewVehiclesAction(vehicleIds: string[], decision: VehicleReviewDecision, reason: string) {
  try {
    const { supabase, userId } = await requireAdmin();
    await enforceRateLimit(supabase, 'vehicle_bulk');
    const ids = validateUuidList(vehicleIds, BULK_ACTION_LIMITS.selectedRecords, 'vehicle ID');
    await VehicleService.bulkReviewVehicles(supabase, ids, decision, reason, userId);
    return { success: true as const };
  } catch (err) {
    await logActionError('bulkReviewVehiclesAction failed', err);
    return toActionError(err);
  }
}

export async function reviewVehicleAction(vehicleId: string, decision: VehicleReviewDecision, reason: string) {
  try {
    const { supabase, userId } = await requireAdmin();
    await VehicleService.reviewVehicle(supabase, validateUuid(vehicleId, 'vehicle ID'), decision, reason, userId);
    return { success: true as const };
  } catch (err) {
    await logActionError('reviewVehicleAction failed', err);
    return toActionError(err);
  }
}

export async function archiveVehicleAction(vehicleId: string, reason: string) {
  try {
    const { supabase, userId } = await requireAdmin();
    await VehicleService.archiveVehicle(supabase, validateUuid(vehicleId, 'vehicle ID'), reason, userId);
    return { success: true as const };
  } catch (err) {
    await logActionError('archiveVehicleAction failed', err);
    return toActionError(err);
  }
}

export async function assignParkingSpotAction(spotId: string, apartmentId: string, vehicleId: string | null, type: string, endsAt: string | null = null) {
  try {
    const { supabase, userId } = await requireAdmin();
    await ParkingService.assignSpot(
      supabase,
      validateUuid(spotId, 'parking spot ID'),
      validateUuid(apartmentId, 'apartment ID'),
      vehicleId ? validateUuid(vehicleId, 'vehicle ID') : null,
      type,
      endsAt,
      userId
    );
    return { success: true as const };
  } catch (err) {
    await logActionError('assignParkingSpotAction failed', err);
    return toActionError(err);
  }
}

export async function transferParkingSpotAction(oldSpotId: string, newSpotId: string, apartmentId: string, vehicleId: string | null, reason: string) {
  try {
    const { supabase, userId } = await requireAdmin();
    await ParkingService.transferSpot(
      supabase,
      validateUuid(oldSpotId, 'source parking spot ID'),
      validateUuid(newSpotId, 'target parking spot ID'),
      validateUuid(apartmentId, 'apartment ID'),
      vehicleId ? validateUuid(vehicleId, 'vehicle ID') : null,
      reason,
      userId
    );
    return { success: true as const };
  } catch (err) {
    await logActionError('transferParkingSpotAction failed', err);
    return toActionError(err);
  }
}

export async function revokeParkingSpotAction(spotId: string, reason: string) {
  try {
    const { supabase, userId } = await requireAdmin();
    await ParkingService.revokeSpot(supabase, validateUuid(spotId, 'parking spot ID'), reason, userId);
    return { success: true as const };
  } catch (err) {
    await logActionError('revokeParkingSpotAction failed', err);
    return toActionError(err);
  }
}

export async function updateSpotStatusAction(spotId: string, newStatus: string, reason: string) {
  try {
    const { supabase, userId } = await requireAdmin();
    // Defense in depth with the DB whitelist (20260702000003): manual status changes
    // may only use the statuses the admin UI offers. Assigned/occupied stay owned by
    // assign/transfer/revoke, conflict by the issue lifecycle, temporary by disruptions.
    if (!PARKING_MANUAL_STATUS_OPTIONS.some((option) => option.value === newStatus)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid manual spot status.');
    }
    await ParkingService.updateSpotStatus(supabase, validateUuid(spotId, 'parking spot ID'), newStatus, reason, userId);
    return { success: true as const };
  } catch (err) {
    await logActionError('updateSpotStatusAction failed', err);
    return toActionError(err);
  }
}

export async function bulkBlockParkingZonesAction(zone: string | null, floor: string | null, reason: string, blockedUntil: string) {
  try {
    const { supabase, userId } = await requireAdmin();
    const results = await ParkingService.bulkBlockZones(supabase, zone, floor, reason, blockedUntil, userId);
    return { success: true as const, meta: { blocked: results.blocked, relocated: results.relocated, unassigned: results.unassigned } };
  } catch (err) {
    await logActionError('bulkBlockParkingZonesAction failed', err);
    return toActionError(err);
  }
}
