// Title: Portal Banner Settings Actions
// Path: src/actions/settings.ts
// Functionality: Admin reads/updates the resident portal banner owned by Notices.

'use server';

import { requireAdmin } from '@/lib/auth';
import { toActionError, toDatabaseAppError } from '@/lib/errors';
import { logActionError } from '@/lib/action-logger';
import { en } from '@/localization/en';
import { SettingsService } from '@/services/SettingsService';

export interface PortalBannerSettings {
  id: string;
  building_name: string;
  timezone: string;
  resident_portal_notice: string;
  updated_at: string | null;
}

interface DbError {
  code?: string;
  message?: string;
}

const isMissingSettingsTable = (error: DbError | null | undefined) =>
  error?.code === '42P01' || (error?.message || '').toLowerCase().includes('building_settings');
const settingsErrors = en.adminSettings.actionErrors;

export async function loadSettingsAction() {
  try {
    const { supabase, ...currentUser } = await requireAdmin();
    const { data, error } = await supabase
      .from('building_settings')
      .select('id, building_name, timezone, resident_portal_notice, updated_at')
      .order('updated_at', { ascending: true, nullsFirst: true })
      .limit(1)
      .maybeSingle();
    if (error && !isMissingSettingsTable(error)) {
      throw toDatabaseAppError(error, { INTERNAL_ERROR: settingsErrors.loadSettings });
    }
    return {
      success: true as const,
      currentUser,
      settings: error ? null : (data || null) as PortalBannerSettings | null,
      settingsTableReady: !error,
    };
  } catch (err) {
    await logActionError('loadSettingsAction failed', err);
    return toActionError(err);
  }
}

// Operational policies are fixed by PD-010 and enforced in SQL, not user-tunable settings.
export async function updatePortalNoticeAction(notice: string) {
  try {
    const { supabase, userId } = await requireAdmin();
    await SettingsService.updatePortalNotice(supabase, { notice, actorId: userId });
    return { success: true as const };
  } catch (err) {
    await logActionError('updatePortalNoticeAction failed', err);
    return toActionError(err);
  }
}
