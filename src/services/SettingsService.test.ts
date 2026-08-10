// Title: Settings Service Test
// Path: src/services/SettingsService.test.ts
// Functionality: Unit coverage for the typed portal-banner RPC adapter and compatibility fallback.

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsService } from './SettingsService';

const actorId = '11111111-1111-4111-8111-111111111111';

function supabaseWithRpc(rpc = vi.fn()) {
  return { rpc } as unknown as SupabaseClient;
}

describe('SettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the portal notice through the narrow typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(SettingsService.updatePortalNotice(supabase, {
      notice: '  Garage cleaning tonight.  ',
      actorId,
    })).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('tx_update_portal_notice', {
      p_notice: 'Garage cleaning tonight.',
      p_actor: actorId,
    });
  });

  it('uses the legacy settings RPC only when the portal-notice RPC is missing', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'tx_update_portal_notice not found' } })
      .mockResolvedValueOnce({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(SettingsService.updatePortalNotice(supabase, {
      notice: ' Garage maintenance cleared. ',
      actorId,
    })).resolves.toBeUndefined();

    expect(rpc).toHaveBeenNthCalledWith(1, 'tx_update_portal_notice', {
      p_notice: 'Garage maintenance cleared.',
      p_actor: actorId,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'tx_update_settings', {
      p_settings: { resident_portal_notice: 'Garage maintenance cleared.' },
      p_actor: actorId,
    });
  });

  it('does not fall back when the portal-notice RPC rejects the caller', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(SettingsService.updatePortalNotice(supabase, {
      notice: 'Garage cleaning tonight.',
      actorId,
    })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
    });

    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('maps legacy fallback failures to safe action errors', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: '42883', message: 'function tx_update_portal_notice does not exist' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'internal database failure' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(SettingsService.updatePortalNotice(supabase, {
      notice: 'Garage cleaning tonight.',
      actorId,
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update resident portal banner.',
    });
  });
});
