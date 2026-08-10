// Title: Event Service Test
// Path: src/services/EventService.test.ts
// Functionality: Unit coverage for the typed incident-resolution RPC adapter.

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from './EventService';

const eventId = '11111111-1111-4111-8111-111111111111';

function supabaseWithRpc(rpc = vi.fn()) {
  return { rpc } as unknown as SupabaseClient;
}

describe('EventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves an incident through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(EventService.resolveIncident(supabase, {
      eventId: ` ${eventId} `,
      resolutionNote: '  Resident contacted and issue cleared.  ',
    })).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_resolve_event', {
      p_event_id: eventId,
      p_resolution_note: 'Resident contacted and issue cleared.',
    });
  });

  it('rejects an empty resolution note before calling the database', async () => {
    const rpc = vi.fn();
    const supabase = supabaseWithRpc(rpc);

    await expect(EventService.resolveIncident(supabase, {
      eventId,
      resolutionNote: '   ',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Enter a resolution note.',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps incident RPC failures to safe errors', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0002', message: 'NOT_FOUND: event' },
    });
    const supabase = supabaseWithRpc(rpc);

    await expect(EventService.resolveIncident(supabase, {
      eventId,
      resolutionNote: 'Resident contacted and issue cleared.',
    })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Incident not found.',
    });
  });
});
