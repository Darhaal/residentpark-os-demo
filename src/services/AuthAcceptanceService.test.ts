// Title: Auth Acceptance Service Test
// Path: src/services/AuthAcceptanceService.test.ts
// Functionality: Unit coverage for invitation consumption and pending-account finalization RPC contracts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthAcceptanceService } from './AuthAcceptanceService';

const inviteToken = '11111111-1111-4111-8111-111111111111';

function supabaseWithRpc(rpc = vi.fn()) {
  return { rpc } as unknown as SupabaseClient;
}

describe('AuthAcceptanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consumes invitations through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(AuthAcceptanceService.consumeInvitation(supabase, ` ${inviteToken} `))
      .resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_consume_invitation', {
      p_token: inviteToken,
    });
  });

  it('does not call the database for an empty invite token', async () => {
    const rpc = vi.fn();
    const supabase = supabaseWithRpc(rpc);

    await expect(AuthAcceptanceService.consumeInvitation(supabase, '   '))
      .resolves.toBeUndefined();

    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps invitation consumption failures to safe errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'transaction failed' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(AuthAcceptanceService.consumeInvitation(supabase, inviteToken))
      .rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'Invitation acceptance failed.',
      });
  });

  it('finalizes pending accounts through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { finalized: true }, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(AuthAcceptanceService.finalizePendingAccount(supabase))
      .resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_finalize_pending_account');
  });

  it('maps pending-account finalization permission failures to safe errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(AuthAcceptanceService.finalizePendingAccount(supabase))
      .rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
      });
  });
});
