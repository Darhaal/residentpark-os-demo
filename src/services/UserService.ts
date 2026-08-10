// Title: User Service
// Path: src/services/UserService.ts
// Functionality: Domain service encapsulating application business rules and database operations.

// Identity-domain orchestration. Apartment occupancy and manager invariants are
// owned by the applied transactional database functions.

import { SupabaseClient } from '@supabase/supabase-js';
import { ACCOUNT_STATUS, USER_ROLES } from '@/config/domain';
import { AppError, toDatabaseAppError } from '@/lib/errors';

type EditableAccountStatus = typeof ACCOUNT_STATUS.approved | typeof ACCOUNT_STATUS.suspended | typeof ACCOUNT_STATUS.rejected;
type EditableUserRole = typeof USER_ROLES.resident | typeof USER_ROLES.admin | typeof USER_ROLES.superadmin;
type BulkEditableUserRole = typeof USER_ROLES.resident | typeof USER_ROLES.admin;
type ProvisionableUserRole = typeof USER_ROLES.resident | typeof USER_ROLES.admin;

interface BulkApproveAndAssignTarget {
  targetUserId: string;
  apartmentId: string | null;
}

export class UserService {
  static async provisionCreatedAccount(
    supabase: SupabaseClient,
    targetUserId: string,
    role: ProvisionableUserRole,
    apartmentId: string | null,
    actorId: string,
  ): Promise<void> {
    if (role === USER_ROLES.resident && !apartmentId) {
      throw new AppError('VALIDATION_ERROR', 'A resident account requires an apartment.');
    }

    // One atomic transaction (0018). A resident is provisioned PENDING with the
    // intended apartment recorded but not occupied; occupancy + approval happen
    // exactly once at acceptance via tx_finalize_pending_account. An admin (no
    // apartment) is provisioned approved in the same single transaction.
    const { error } = await supabase.rpc('tx_provision_pending_account', {
      p_target_id: targetUserId,
      p_role: role,
      p_apartment_id: role === USER_ROLES.resident ? apartmentId : null,
      p_actor_id: actorId,
    });

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Account provisioning transaction failed.' });
  }

  static async changeAccountStatus(
    supabase: SupabaseClient,
    targetUserId: string,
    newStatus: EditableAccountStatus,
    reason: string,
    actorId: string,
  ): Promise<void> {
    if (targetUserId === actorId) {
      throw new AppError('RULE_VIOLATION', 'You cannot change your own account status.');
    }

    const { error } = await supabase.rpc('tx_identity_update_status', {
      p_target_id: targetUserId,
      p_new_status: newStatus,
      p_reason: reason,
    });

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Account status transaction failed.' });
  }

  static async bulkChangeAccountStatus(
    supabase: SupabaseClient,
    targetUserIds: string[],
    newStatus: EditableAccountStatus,
    reason: string,
    actorId: string,
  ): Promise<void> {
    if (!targetUserIds.length) return;
    if (targetUserIds.includes(actorId)) {
      throw new AppError('RULE_VIOLATION', 'A bulk action cannot include your own account.');
    }

    const { error } = await supabase.rpc('tx_identity_bulk_update_status', {
      p_target_ids: targetUserIds,
      p_new_status: newStatus,
      p_reason: reason,
    });

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Bulk account status transaction failed.' });
  }

  static async approveAndAssign(
    supabase: SupabaseClient,
    targetUserId: string,
    apartmentId: string,
    reason: string,
    actorId: string,
  ): Promise<void> {
    if (targetUserId === actorId) {
      throw new AppError('RULE_VIOLATION', 'You cannot approve or assign your own account.');
    }

    const { error } = await supabase.rpc('tx_identity_approve_and_assign', {
      p_target_id: targetUserId,
      p_apartment_id: apartmentId,
      p_reason: reason,
    });

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Approve and assign transaction failed.' });
  }

  static async bulkApproveAndAssign(
    supabase: SupabaseClient,
    targets: BulkApproveAndAssignTarget[],
    reason: string,
  ): Promise<void> {
    if (!targets.length) return;

    const { error } = await supabase.rpc('tx_identity_bulk_approve_and_assign', {
      p_targets: targets,
      p_reason: reason,
    });

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Bulk approval transaction failed.' });
  }

  static async updatePermissions(
    supabase: SupabaseClient,
    targetUserId: string,
    newRole: EditableUserRole,
    isManager: boolean,
    newApartmentId: string | null,
    reason: string,
    actorId: string,
  ): Promise<void> {
    if (targetUserId === actorId) {
      throw new AppError('RULE_VIOLATION', 'You cannot modify your own privileges.');
    }

    const { error } = await supabase.rpc('tx_identity_update_permissions', {
      p_target_id: targetUserId,
      p_new_role: newRole,
      p_is_manager: newRole === USER_ROLES.resident ? isManager : false,
      p_apartment_id: newApartmentId,
      p_reason: reason,
    });

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Permission transaction failed.' });
  }

  static async bulkUpdatePermissions(
    supabase: SupabaseClient,
    targetUserIds: string[],
    newRole: BulkEditableUserRole,
    reason: string,
    actorId: string,
  ): Promise<void> {
    if (!targetUserIds.length) return;
    if (targetUserIds.includes(actorId)) {
      throw new AppError('RULE_VIOLATION', 'A bulk action cannot include your own account.');
    }

    const { error } = await supabase.rpc('tx_identity_bulk_update_permissions', {
      p_target_ids: targetUserIds,
      p_new_role: newRole,
      p_reason: reason,
    });

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Bulk permission transaction failed.' });
  }
}
