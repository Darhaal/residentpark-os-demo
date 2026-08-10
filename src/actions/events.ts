// Title: Event Server Actions
// Path: src/actions/events.ts
// Functionality: Server actions for resolving operational incidents.

'use server';

import { toActionError } from '@/lib/errors';
import { logActionError } from '@/lib/action-logger';
import { requireAdmin } from '@/lib/auth';
import { EventService } from '@/services/EventService';

export async function resolveIncidentAction(eventId: string, resolutionNote: string) {
  try {
    const { supabase } = await requireAdmin();
    await EventService.resolveIncident(supabase, { eventId, resolutionNote });
    return { success: true as const };
  } catch (error) {
    await logActionError('Action: resolveIncidentAction failed', error);
    return toActionError(error);
  }
}
