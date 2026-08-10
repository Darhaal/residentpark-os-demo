// Title: Event Domain Service
// Path: src/services/EventService.ts
// Functionality: Typed adapter for operational event incident-resolution RPCs.

import type { SupabaseClient } from '@supabase/supabase-js';
import { validateUuid } from '@/lib/action-validation';
import { AppError, toDatabaseAppError } from '@/lib/errors';

interface ResolveIncidentParams {
  eventId: string;
  resolutionNote: string;
}

const resolveIncidentErrors = {
  NOT_FOUND: 'Incident not found.',
  RULE_VIOLATION: 'Only open or in-progress incidents can be resolved.',
  VALIDATION_ERROR: 'Enter a resolution note.',
  INTERNAL_ERROR: 'Failed to resolve incident.',
} as const;

export class EventService {
  static async resolveIncident(supabase: SupabaseClient, params: ResolveIncidentParams): Promise<void> {
    const eventId = validateUuid(params.eventId, 'event ID');
    const resolutionNote = typeof params.resolutionNote === 'string' ? params.resolutionNote.trim() : '';

    if (!resolutionNote || resolutionNote.length > 4000) {
      throw new AppError('VALIDATION_ERROR', resolveIncidentErrors.VALIDATION_ERROR);
    }

    const { error } = await supabase.rpc('tx_resolve_event', {
      p_event_id: eventId,
      p_resolution_note: resolutionNote,
    });

    if (error) {
      throw toDatabaseAppError(error, resolveIncidentErrors);
    }
  }
}
