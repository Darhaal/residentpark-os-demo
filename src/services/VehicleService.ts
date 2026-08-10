// Title: Vehicle Domain Service
// Path: src/services/VehicleService.ts
// Functionality: Validates with owner_id and delegates all state mutation + event
//   logging to transactional DB RPCs.

import { SupabaseClient } from '@supabase/supabase-js';
import { AppError, toDatabaseAppError } from '@/lib/errors';
import { VehicleStatusChangedPayload, VehicleSubmittedPayload } from '@/domain/contracts';
import { VEHICLE_APPROVAL_STATUS } from '@/config/domain';

type VehicleReviewDecision = typeof VEHICLE_APPROVAL_STATUS.approved | typeof VEHICLE_APPROVAL_STATUS.rejected;

export class VehicleService {
  private static isNotFound(error: { code?: string } | null | undefined) {
    return error?.code === 'PGRST116';
  }

  private static normalize(plate: string, make: string, model: string, color: string, year: number) {
    const cleanPlate = plate.trim().toUpperCase();
    if (!cleanPlate || cleanPlate.length < 2) throw new AppError('VALIDATION_ERROR', 'Invalid plate number.');
    if (!make || make.trim().length === 0) throw new AppError('VALIDATION_ERROR', 'Vehicle make (brand) is required.');

    const currentYear = new Date().getFullYear();
    if (year && (year < 1980 || year > currentYear + 1)) {
      throw new AppError('VALIDATION_ERROR', `Year must be between 1980 and ${currentYear + 1}.`);
    }

    return {
      plate_number: cleanPlate,
      make: make.trim(),
      model: model?.trim() || null,
      color: color?.trim() || null,
      year: year || null
    };
  }

  static async submitRequest(supabase: SupabaseClient, apartmentId: string, ownerId: string | null, plateNumber: string, make: string, model: string, color: string, year: number, actorId: string): Promise<void> {
    const { data: apt, error: aptErr } = await supabase.from('apartments').select('id').eq('id', apartmentId).single();
    if (aptErr || !apt) throw new AppError('NOT_FOUND', 'Valid apartment required.');

    const norm = this.normalize(plateNumber, make, model, color, year);

    // STRICT CONTRACT: No "any" casting needed anymore
    const payload: VehicleSubmittedPayload = {
      plate_number: norm.plate_number,
      make: norm.make,
      model: norm.model,
      owner_id: ownerId,
      operation_type: 'manual'
    };

    // ACID COMPLIANCE: Use RPC instead of direct insert + manual event publish
    const { error: txError } = await supabase.rpc('tx_submit_vehicle_request', {
      p_apartment_id: apartmentId,
      p_owner_id: ownerId,
      p_actor_id: actorId,
      p_payload: payload,
      p_plate_number: norm.plate_number,
      p_make: norm.make,
      p_model: norm.model,
      p_color: norm.color,
      p_year: norm.year
    });

    if (txError) {
      throw toDatabaseAppError(txError, {
        CONFLICT: 'Vehicle with this plate already exists.',
        INTERNAL_ERROR: 'Submit request failed.'
      });
    }
  }

  static async addByAdmin(supabase: SupabaseClient, apartmentId: string, ownerId: string | null, plateNumber: string, make: string, model: string, color: string, year: number, actorId: string): Promise<void> {
    const { data: apt, error: aptErr } = await supabase.from('apartments').select('id').eq('id', apartmentId).single();
    if (aptErr || !apt) throw new AppError('NOT_FOUND', 'Valid apartment required.');

    const norm = this.normalize(plateNumber, make, model, color, year);

    const payload: VehicleSubmittedPayload = {
      plate_number: norm.plate_number,
      make: norm.make,
      model: norm.model,
      owner_id: ownerId,
      operation_type: 'manual'
    };

    const { error: txError } = await supabase.rpc('tx_add_vehicle_by_admin', {
      p_apartment_id: apartmentId,
      p_owner_id: ownerId,
      p_actor_id: actorId,
      p_payload: payload,
      p_plate_number: norm.plate_number,
      p_make: norm.make,
      p_model: norm.model,
      p_color: norm.color,
      p_year: norm.year
    });

    if (txError) {
      throw toDatabaseAppError(txError, {
        CONFLICT: 'Vehicle with this plate already exists.',
        INTERNAL_ERROR: 'Add failed.'
      });
    }
  }

  static async reviewVehicle(supabase: SupabaseClient, vehicleId: string, decision: VehicleReviewDecision, reason: string, actorId: string): Promise<void> {
    const { data: vehicle, error: vehicleErr } = await supabase
      .from('vehicles')
      .select('plate_number, approval_status, apartment_id')
      .eq('id', vehicleId)
      .single();
    if (vehicleErr && !this.isNotFound(vehicleErr)) {
      throw toDatabaseAppError(vehicleErr, { INTERNAL_ERROR: 'Failed to load vehicle for review.' });
    }
    if (!vehicle) throw new AppError('NOT_FOUND', 'Vehicle not found.');
    if (vehicle.approval_status === decision) return;

    const payload: VehicleStatusChangedPayload = { plate_number: vehicle.plate_number, old_status: vehicle.approval_status, new_status: decision, reason, operation_type: 'manual' };
    const { error: txError } = await supabase.rpc('tx_review_vehicle', { p_vehicle_id: vehicleId, p_decision: decision, p_reason: reason, p_actor_id: actorId, p_payload: payload });
    if (txError) throw toDatabaseAppError(txError, { INTERNAL_ERROR: 'Transaction failed.' });
  }

  static async bulkReviewVehicles(supabase: SupabaseClient, vehicleIds: string[], decision: VehicleReviewDecision, reason: string, actorId: string): Promise<void> {
    if (!vehicleIds.length) return;
    const { error: txError } = await supabase.rpc('tx_bulk_review_vehicles', { p_vehicle_ids: vehicleIds, p_decision: decision, p_reason: reason, p_actor_id: actorId, p_payload: { new_status: decision, reason, operation_type: 'bulk' } });
    if (txError) throw toDatabaseAppError(txError, { INTERNAL_ERROR: 'Bulk review failed.' });
  }

  static async archiveVehicle(supabase: SupabaseClient, vehicleId: string, reason: string, actorId: string): Promise<void> {
    const { error: txError } = await supabase.rpc('tx_archive_vehicle', { p_vehicle_id: vehicleId, p_actor_id: actorId, p_reason: reason || 'Admin archived' });
    if (txError) throw toDatabaseAppError(txError, { INTERNAL_ERROR: 'Archive failed.' });
  }
}
