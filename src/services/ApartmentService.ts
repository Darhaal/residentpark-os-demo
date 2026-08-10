// Title: Property Domain Service
// Path: src/services/ApartmentService.ts
// Functionality: Encapsulates all business logic for the Property Domain.
// Enforces hard rules, uses strictly typed payloads, and orchestrates transactional events.

import { SupabaseClient } from '@supabase/supabase-js';
import { AppError, toDatabaseAppError } from '@/lib/errors';
import { SystemSettingsChangedPayload } from '@/domain/contracts';
import { APARTMENT_STATUS, isAdminRole } from '@/config/domain';

export class ApartmentService {
  private static isNotFound(error: { code?: string } | null | undefined) {
    return error?.code === 'PGRST116';
  }

  static async changeStatus(
    supabase: SupabaseClient,
    apartmentId: string,
    newStatus: (typeof APARTMENT_STATUS)[keyof typeof APARTMENT_STATUS],
    reason: string
  ): Promise<void> {
    const { error } = await supabase.rpc('tx_apartment_update_status', {
      p_apartment_id: apartmentId,
      p_new_status: newStatus,
      p_reason: reason,
    });

    if (error) {
      throw toDatabaseAppError(error, {
        RULE_VIOLATION: 'An apartment with assigned residents cannot be marked vacant.',
        NOT_FOUND: 'Apartment not found.',
        INTERNAL_ERROR: 'Apartment status transaction failed.'
      });
    }
  }

  static async reportIncident(
    supabase: SupabaseClient,
    apartmentId: string,
    content: string,
    severity: 'info' | 'warning' | 'critical'
  ): Promise<void> {
    const { error } = await supabase.rpc('tx_add_apartment_event', {
      p_apartment_id: apartmentId,
      p_content: content,
      p_severity: severity,
    });

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Failed to add apartment event.' });
  }

  static async assignAdmin(
    supabase: SupabaseClient,
    apartmentId: string,
    adminId: string | null,
    actorId: string
  ): Promise<void> {
    const { data: apt, error: aptErr } = await supabase.from('apartments').select('apartment_number, assigned_admin_id').eq('id', apartmentId).single();
    if (aptErr && !this.isNotFound(aptErr)) {
      throw toDatabaseAppError(aptErr, { INTERNAL_ERROR: 'Failed to load apartment for admin assignment.' });
    }
    if (!apt) throw new AppError('NOT_FOUND', 'Apartment not found.');
    if (apt.assigned_admin_id === adminId) return;

    let adminEmail = 'Unassigned';

    if (adminId) {
      const { data: admin, error: adminErr } = await supabase.from('profiles').select('role, email').eq('id', adminId).single();
      if (adminErr && !this.isNotFound(adminErr)) {
        throw toDatabaseAppError(adminErr, { INTERNAL_ERROR: 'Failed to load target admin.' });
      }
      if (!admin) throw new AppError('NOT_FOUND', 'Target admin not found.');
      if (!isAdminRole(admin.role)) {
        throw new AppError('RULE_VIOLATION', 'Only users with admin or superadmin roles can be assigned to an apartment.');
      }
      adminEmail = admin.email;
    }

    // ENFORCED: Strict payload typing for transparency
    const payload: SystemSettingsChangedPayload = {
      content: `Assigned unit responsibility to ${adminEmail}`,
      apartment_number: apt.apartment_number,
      old_admin_id: apt.assigned_admin_id,
      new_admin_id: adminId,
      operation_type: 'manual'
    };

    // EXECUTE ATOMIC TRANSACTION
    const { error: txError } = await supabase.rpc('tx_assign_admin', {
      p_apartment_id: apartmentId,
      p_admin_id: adminId,
      p_actor_id: actorId,
      p_payload: payload,
      p_severity: 'info'
    });

    if (txError) throw toDatabaseAppError(txError, { INTERNAL_ERROR: 'Transaction failed during admin assignment.' });
  }
}
