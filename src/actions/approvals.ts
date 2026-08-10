// Title: Approval Management Actions
// Path: src/actions/approvals.ts
// Functionality: Server actions for processing pending registrations.
//
// Approving/rejecting accounts is an admin-only operation, guarded by requireAdmin().

'use server';

import { logActionError } from '@/lib/action-logger';
import { UserService } from '@/services/UserService';
import { toActionError } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { ACCOUNT_STATUS } from '@/config/domain';
import { validateUuid } from '@/lib/action-validation';

type AccountReviewDecision = typeof ACCOUNT_STATUS.approved | typeof ACCOUNT_STATUS.rejected;

export async function processAccountRequest(targetUserId: string, decision: AccountReviewDecision, reason: string) {
  try {
    const { supabase, userId } = await requireAdmin();

    // Reuse the powerful Domain Service method
    await UserService.changeAccountStatus(supabase, validateUuid(targetUserId, 'user ID'), decision, reason, userId);

    return { success: true as const };
  } catch (error) {
    await logActionError('Action: processAccountRequest failed', error);
    return toActionError(error);
  }
}
