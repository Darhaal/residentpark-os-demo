// Title: Quick Approve & Assign Action
// Path: src/actions/quick-approve.ts
// Functionality: Server action to approve a user and securely assign an apartment
// using atomic RPC transactions.

'use server';

import { UserService } from '@/services/UserService';
import { logActionError } from '@/lib/action-logger';
import { toActionError } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { ACCOUNT_STATUS } from '@/config/domain';
import { BULK_ACTION_LIMITS } from '@/config/limits';
import { validateBulkSize, validateUuid } from '@/lib/action-validation';

export async function approveAndAssignUnitAction(targetUserId: string, apartmentId: string | null, reason: string) {
  try {
    const { supabase, userId } = await requireAdmin();
    const cleanTargetUserId = validateUuid(targetUserId, 'user ID');
    const cleanApartmentId = apartmentId ? validateUuid(apartmentId, 'apartment ID') : null;

    // Route traffic cleanly through the Domain Service
    if (cleanApartmentId) {
      await UserService.approveAndAssign(supabase, cleanTargetUserId, cleanApartmentId, reason, userId);
    } else {
      await UserService.changeAccountStatus(supabase, cleanTargetUserId, ACCOUNT_STATUS.approved, reason, userId);
    }

    return { success: true as const };
  } catch (error) {
    await logActionError('approveAndAssignUnitAction failed', error);
    return toActionError(error);
  }
}

export async function bulkApproveAndAssignUnitsAction(targets: { targetUserId: string, apartmentId: string | null }[], reason: string) {
  try {
    const { supabase } = await requireAdmin();
    validateBulkSize(targets, BULK_ACTION_LIMITS.selectedRecords, 'records');
    if (!targets.length) return { success: true as const };
    const cleanTargets = targets.map(t => ({
      targetUserId: validateUuid(t.targetUserId, 'user ID'),
      apartmentId: t.apartmentId ? validateUuid(t.apartmentId, 'apartment ID') : null,
    }));

    await UserService.bulkApproveAndAssign(supabase, cleanTargets, reason);

    return { success: true as const };
  } catch (error) {
    await logActionError('bulkApproveAndAssignUnitsAction failed', error);
    return toActionError(error);
  }
}
