// Title: Apartment Server Actions
// Path: src/actions/apartments.ts
// Functionality: Thin orchestrator layer. Authorizes the caller, then delegates all
// heavy lifting to the Property Domain Service.
//
// All actions require an admin — notes, status, and admin assignment are management
// operations.

'use server';

import { logActionError } from '@/lib/action-logger';
import { ApartmentService } from '@/services/ApartmentService';
import { toActionError } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { APARTMENT_STATUS } from '@/config/domain';
import { validateUuid } from '@/lib/action-validation';

export async function addApartmentNoteAction(
  apartmentId: string,
  content: string,
  severity: 'info' | 'warning' | 'critical' = 'info'
) {
  try {
    const { supabase } = await requireAdmin();
    await ApartmentService.reportIncident(supabase, validateUuid(apartmentId, 'apartment ID'), content, severity);
    return { success: true as const };
  } catch (error) {
    await logActionError('Action: addApartmentNoteAction failed', error);
    return toActionError(error);
  }
}

export async function updateApartmentStatusAction(
  apartmentId: string,
  newStatus: (typeof APARTMENT_STATUS)[keyof typeof APARTMENT_STATUS],
  reason: string
) {
  try {
    const { supabase } = await requireAdmin();
    await ApartmentService.changeStatus(supabase, validateUuid(apartmentId, 'apartment ID'), newStatus, reason);
    return { success: true as const };
  } catch (error) {
    await logActionError('Action: updateApartmentStatusAction failed', error);
    return toActionError(error);
  }
}

export async function assignApartmentAdminAction(apartmentId: string, adminId: string | null) {
  try {
    const { supabase, userId } = await requireAdmin();
    await ApartmentService.assignAdmin(
      supabase,
      validateUuid(apartmentId, 'apartment ID'),
      adminId ? validateUuid(adminId, 'admin ID') : null,
      userId
    );
    return { success: true as const };
  } catch (error) {
    await logActionError('Action: assignApartmentAdminAction failed', error);
    return toActionError(error);
  }
}
