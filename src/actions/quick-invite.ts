// Title: Quick Invite Actions
// Path: src/actions/quick-invite.ts
// Functionality: Next.js Server Actions for application workflows, validation, and persistence.

// Transactional single-apartment invitation action.

'use server';

import { requireAdmin } from '@/lib/auth';
import { toActionError } from '@/lib/errors';
import { logActionError } from '@/lib/action-logger';
import { InvitationService } from '@/services/InvitationService';

export async function quickInviteToApartmentAction(apartmentId: string, email: string) {
  try {
    const { supabase } = await requireAdmin();
    await InvitationService.createInvitation(supabase, { apartmentId, email });
    return { success: true as const };
  } catch (error) {
    await logActionError('quickInviteToApartmentAction failed', error);
    return toActionError(error);
  }
}
