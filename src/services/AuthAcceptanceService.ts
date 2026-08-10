// Title: Auth Acceptance Service
// Path: src/services/AuthAcceptanceService.ts
// Functionality: Typed RPC adapter for invitation consumption and pending-account finalization.

import type { SupabaseClient } from '@supabase/supabase-js';
import { toDatabaseAppError } from '@/lib/errors';

export class AuthAcceptanceService {
  static async consumeInvitation(supabase: SupabaseClient, inviteToken: string | null | undefined): Promise<void> {
    const token = typeof inviteToken === 'string' ? inviteToken.trim() : '';
    if (!token) return;

    const { error } = await supabase.rpc('tx_consume_invitation', { p_token: token });
    if (error) {
      throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Invitation acceptance failed.' });
    }
  }

  static async finalizePendingAccount(supabase: SupabaseClient): Promise<void> {
    const { error } = await supabase.rpc('tx_finalize_pending_account');
    if (error) {
      throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Pending account finalization failed.' });
    }
  }
}
