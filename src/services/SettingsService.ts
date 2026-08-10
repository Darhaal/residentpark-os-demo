// Title: Settings Domain Service
// Path: src/services/SettingsService.ts
// Functionality: Typed adapter for resident portal banner settings RPCs with compatibility fallback.

import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, toDatabaseAppError } from '@/lib/errors';
import { en } from '@/localization/en';

interface UpdatePortalNoticeParams {
  notice: string;
  actorId: string;
}

interface DbError {
  code?: string | null;
  message?: string | null;
}

const messages = en.adminSettings.actionErrors;

const isMissingPortalNoticeRpc = (error: DbError | null | undefined) =>
  error?.code === 'PGRST202' ||
  error?.code === '42883' ||
  (error?.message || '').toLowerCase().includes('tx_update_portal_notice');

export class SettingsService {
  static async updatePortalNotice(supabase: SupabaseClient, params: UpdatePortalNoticeParams): Promise<void> {
    if (typeof params.notice !== 'string') {
      throw new AppError('VALIDATION_ERROR', messages.updateSettings);
    }

    const notice = params.notice.trim();
    const { error } = await supabase.rpc('tx_update_portal_notice', {
      p_notice: notice,
      p_actor: params.actorId,
    });

    if (!error) return;

    if (!isMissingPortalNoticeRpc(error)) {
      throw toDatabaseAppError(error, { INTERNAL_ERROR: messages.updateSettings });
    }

    const fallback = await supabase.rpc('tx_update_settings', {
      p_settings: { resident_portal_notice: notice },
      p_actor: params.actorId,
    });

    if (fallback.error) {
      throw toDatabaseAppError(fallback.error, { INTERNAL_ERROR: messages.updateSettings });
    }
  }
}
