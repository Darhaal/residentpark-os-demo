// Title: Disruption Service Test
// Path: src/services/DisruptionService.test.ts
// Functionality: Unit coverage for disruption service RPC adapter contracts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DisruptionService } from './DisruptionService';

const actorId = '11111111-1111-4111-8111-111111111111';
const spotId = '22222222-2222-4222-8222-222222222222';
const secondSpotId = '33333333-3333-4333-8333-333333333333';
const disruptionId = '44444444-4444-4444-8444-444444444444';

function supabaseWithRpc(rpc = vi.fn()) {
  return { rpc } as unknown as SupabaseClient;
}

describe('DisruptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates disruptions through the typed RPC contract and validates summary shape', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        disruption_id: disruptionId,
        blocked: 2,
        relocated: 1,
        needs_placement: 0,
      },
      error: null,
    });
    const supabase = supabaseWithRpc(rpc);

    await expect(DisruptionService.create(
      supabase,
      [spotId, secondSpotId],
      ' Level 2 repair ',
      ' Concrete work ',
      '2026-07-01',
      '2026-07-03',
      actorId,
    )).resolves.toEqual({
      disruption_id: disruptionId,
      blocked: 2,
      relocated: 1,
      needs_placement: 0,
    });

    expect(rpc).toHaveBeenCalledWith('tx_create_disruption', {
      p_spot_ids: [spotId, secondSpotId],
      p_title: 'Level 2 repair',
      p_reason: 'Concrete work',
      p_start: '2026-07-01',
      p_end: '2026-07-03',
      p_actor: actorId,
    });
  });

  it('rejects invalid create input before calling the database', async () => {
    const rpc = vi.fn();
    const supabase = supabaseWithRpc(rpc);

    await expect(DisruptionService.create(
      supabase,
      [],
      'Level 2 repair',
      'Concrete work',
      '2026-07-01',
      '2026-07-03',
      actorId,
    )).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Select at least one spot to block.',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects invalid date ranges before calling the database', async () => {
    const rpc = vi.fn();
    const supabase = supabaseWithRpc(rpc);

    await expect(DisruptionService.create(
      supabase,
      [spotId],
      'Level 2 repair',
      'Concrete work',
      '2026-07-04',
      '2026-07-03',
      actorId,
    )).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'End date must be on or after the start date.',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps create RPC failures to safe errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'transaction failed' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(DisruptionService.create(
      supabase,
      [spotId],
      'Level 2 repair',
      'Concrete work',
      '2026-07-01',
      '2026-07-03',
      actorId,
    )).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create disruption.',
    });
  });

  it('rejects malformed create summaries instead of returning loose RPC data', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { disruption_id: disruptionId, blocked: '2' },
      error: null,
    });
    const supabase = supabaseWithRpc(rpc);

    await expect(DisruptionService.create(
      supabase,
      [spotId],
      'Level 2 repair',
      'Concrete work',
      '2026-07-01',
      '2026-07-03',
      actorId,
    )).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Disruption transaction returned an invalid summary.',
    });
  });

  it('completes disruptions through the typed RPC contract and validates summary shape', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        returned: 1,
        needs_review: 1,
        unblocked: 2,
      },
      error: null,
    });
    const supabase = supabaseWithRpc(rpc);

    await expect(DisruptionService.complete(supabase, disruptionId, actorId))
      .resolves.toEqual({
        returned: 1,
        needs_review: 1,
        unblocked: 2,
      });

    expect(rpc).toHaveBeenCalledWith('tx_complete_disruption', {
      p_disruption_id: disruptionId,
      p_actor: actorId,
    });
  });

  it('maps complete RPC failures to safe errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(DisruptionService.complete(supabase, disruptionId, actorId))
      .rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
      });
  });

  it('activates scheduled disruptions through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { blocked: 2, relocated: 1, needs_placement: 0 },
      error: null,
    });
    const supabase = supabaseWithRpc(rpc);

    await expect(DisruptionService.activate(supabase, disruptionId))
      .resolves.toEqual({ blocked: 2, relocated: 1, needs_placement: 0 });

    expect(rpc).toHaveBeenCalledWith('tx_activate_disruption', {
      p_disruption_id: disruptionId,
    });
  });

  it('maps activate RPC failures to safe errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'transaction failed' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(DisruptionService.activate(supabase, disruptionId))
      .rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'Failed to activate disruption.',
      });
  });

  it('activates due disruptions through the scheduler RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 3, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(DisruptionService.activateDue(supabase)).resolves.toBe(3);

    expect(rpc).toHaveBeenCalledWith('tx_activate_due_disruptions');
  });

  it('cancels scheduled disruptions through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'cancelled' }, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(DisruptionService.cancel(supabase, disruptionId, actorId)).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_cancel_disruption', {
      p_disruption_id: disruptionId,
      p_actor: actorId,
    });
  });

  it('maps cancel RPC failures to safe errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'transaction failed' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(DisruptionService.cancel(supabase, disruptionId, actorId))
      .rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'Failed to cancel disruption.',
      });
  });
});
