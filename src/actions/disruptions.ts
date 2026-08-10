// Title: Construction Disruption Actions
// Path: src/actions/disruptions.ts
// Functionality: Admin Server Actions for the construction/disruption workflow.

'use server';

import { requireAdmin } from '@/lib/auth';
import { toActionError, AppError, toDatabaseAppError } from '@/lib/errors';
import { logActionError } from '@/lib/action-logger';
import { enforceRateLimit } from '@/lib/rate-limit';
import { DisruptionService } from '@/services/DisruptionService';
import { en } from '@/localization/en';
import { BULK_ACTION_LIMITS } from '@/config/limits';
import { resolveDateOnly, validateUuid, validateUuidList } from '@/lib/action-validation';

const disruptionErrors = en.adminDisruptions.actionErrors;

export async function loadDisruptionsAction() {
  try {
    const { supabase, ...currentUser } = await requireAdmin();

    // Lazily activate any scheduled disruptions whose start date has arrived so the list
    // reflects reality without a dedicated scheduler. Best-effort; a daily pg_cron / Edge
    // Function calling tx_activate_due_disruptions() is still the recommended path.
    try { await DisruptionService.activateDue(supabase); } catch { /* non-blocking */ }

    const [disr, rel, blockedSpots, spots] = await Promise.all([
      supabase.from('parking_disruptions').select('*').order('created_at', { ascending: false }),
      supabase.from('temporary_relocations').select('disruption_id, status'),
      supabase.from('parking_disruption_spots').select('disruption_id, spot_id'),
      supabase.from('parking_spots').select('*'),
    ]);

    if (disr.error) throw toDatabaseAppError(disr.error, { INTERNAL_ERROR: disruptionErrors.loadDisruptions });
    if (rel.error) throw toDatabaseAppError(rel.error, { INTERNAL_ERROR: disruptionErrors.loadRelocations });
    if (blockedSpots.error) throw toDatabaseAppError(blockedSpots.error, { INTERNAL_ERROR: disruptionErrors.loadSpots });
    if (spots.error) throw toDatabaseAppError(spots.error, { INTERNAL_ERROR: disruptionErrors.loadParkingSpots });

    return {
      success: true as const,
      currentUser,
      disruptions: disr.data || [],
      relocations: rel.data || [],
      blockedSpots: blockedSpots.data || [],
      spots: spots.data || [],
    };
  } catch (err) {
    await logActionError('loadDisruptionsAction failed', err);
    return toActionError(err);
  }
}

export async function createDisruptionAction(input: { spotIds: string[]; title: string; reason: string; startDate: string; endDate: string }) {
  try {
    const { supabase, userId } = await requireAdmin();
    await enforceRateLimit(supabase, 'disruption_create');
    const spotIds = validateUuidList(input.spotIds, BULK_ACTION_LIMITS.selectedRecords, 'parking spot ID');
    const startDate = resolveDateOnly(input.startDate, 'start date');
    const endDate = resolveDateOnly(input.endDate, 'end date');
    if (!startDate || !endDate) throw new AppError('VALIDATION_ERROR', disruptionErrors.invalidDateRange);
    const meta = await DisruptionService.create(supabase, spotIds, input.title, input.reason, startDate, endDate, userId);
    return { success: true as const, meta };
  } catch (err) {
    await logActionError('createDisruptionAction failed', err);
    return toActionError(err);
  }
}

export async function updateDisruptionAction(input: { disruptionId: string; spotIds: string[]; title: string; reason: string; startDate: string; endDate: string }) {
  try {
    const { supabase, userId } = await requireAdmin();
    await enforceRateLimit(supabase, 'disruption_create');
    const disruptionId = validateUuid(input.disruptionId, 'disruption ID');
    const spotIds = validateUuidList(input.spotIds, BULK_ACTION_LIMITS.selectedRecords, 'parking spot ID');
    const startDate = resolveDateOnly(input.startDate, 'start date');
    const endDate = resolveDateOnly(input.endDate, 'end date');
    if (!startDate || !endDate) throw new AppError('VALIDATION_ERROR', disruptionErrors.invalidDateRange);
    const meta = await DisruptionService.update(supabase, disruptionId, spotIds, input.title, input.reason, startDate, endDate, userId);
    return { success: true as const, meta };
  } catch (err) {
    await logActionError('updateDisruptionAction failed', err);
    return toActionError(err);
  }
}

export async function completeDisruptionAction(disruptionId: string) {
  try {
    const { supabase, userId } = await requireAdmin();
    await enforceRateLimit(supabase, 'disruption_complete');
    const meta = await DisruptionService.complete(supabase, validateUuid(disruptionId, 'disruption ID'), userId);
    return { success: true as const, meta };
  } catch (err) {
    await logActionError('completeDisruptionAction failed', err);
    return toActionError(err);
  }
}

export async function activateDisruptionAction(disruptionId: string) {
  try {
    const { supabase } = await requireAdmin();
    await enforceRateLimit(supabase, 'disruption_activate');
    const meta = await DisruptionService.activate(supabase, validateUuid(disruptionId, 'disruption ID'));
    return { success: true as const, meta };
  } catch (err) {
    await logActionError('activateDisruptionAction failed', err);
    return toActionError(err);
  }
}

export async function activateDueDisruptionsAction() {
  try {
    const { supabase } = await requireAdmin();
    const activated = await DisruptionService.activateDue(supabase);
    return { success: true as const, activated };
  } catch (err) {
    await logActionError('activateDueDisruptionsAction failed', err);
    return toActionError(err);
  }
}

export async function cancelDisruptionAction(disruptionId: string) {
  try {
    const { supabase, userId } = await requireAdmin();
    await enforceRateLimit(supabase, 'disruption_cancel');
    await DisruptionService.cancel(supabase, validateUuid(disruptionId, 'disruption ID'), userId);
    return { success: true as const };
  } catch (err) {
    await logActionError('cancelDisruptionAction failed', err);
    return toActionError(err);
  }
}
