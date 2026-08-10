// Title: Notices Actions
// Path: src/actions/notices.ts
// Functionality: Admin sends in-app notices to residents; residents read + mark them read.

'use server';

import { requireAdmin, requireApprovedUser } from '@/lib/auth';
import { toActionError, toDatabaseAppError } from '@/lib/errors';
import { logActionError } from '@/lib/action-logger';
import { enforceRateLimit } from '@/lib/rate-limit';
import { ACCOUNT_STATUS, USER_ROLES } from '@/config/domain';
import { PAGE_LIMITS } from '@/config/limits';
import { validateUuid } from '@/lib/action-validation';
import { en } from '@/localization/en';
import { NoticeService, type NoticeAudience, type NoticeType } from '@/services/NoticeService';

export interface NoticeRow {
  id: string; batch_id: string; recipient_id: string; title: string; body: string;
  type: string; created_at: string; read_at: string | null;
}

const adminNoticeErrors = en.adminNotices.actionErrors;
const residentNoticeErrors = en.residentNotices.actionErrors;

// ── Admin ─────────────────────────────────────────────────────────────────────
export async function sendNoticeAction(input: {
  audience: NoticeAudience;
  apartmentId?: string | null;
  targetId?: string | null;
  title: string;
  body: string;
  type: NoticeType;
}) {
  try {
    const { supabase } = await requireAdmin();
    await enforceRateLimit(supabase, 'notice_send');
    const meta = await NoticeService.sendNotice(supabase, input);
    return { success: true as const, meta };
  } catch (err) {
    await logActionError('sendNoticeAction failed', err);
    return toActionError(err);
  }
}

export async function loadAdminNoticesAction() {
  try {
    const { supabase, ...currentUser } = await requireAdmin();
    const [noticesRes, aptsRes, residentsRes] = await Promise.all([
      supabase.from('notices').select('id, batch_id, recipient_id, title, body, type, created_at, read_at').order('created_at', { ascending: false }).limit(PAGE_LIMITS.adminNotices),
      supabase.from('apartments').select('id, apartment_number').order('apartment_number'),
      supabase.from('profiles').select('id, full_name, email, apartments:apartments!profiles_apartment_id_fkey(apartment_number)').eq('role', USER_ROLES.resident).eq('approval_status', ACCOUNT_STATUS.approved).order('full_name').limit(PAGE_LIMITS.noticeRecipients),
    ]);
    if (noticesRes.error) throw toDatabaseAppError(noticesRes.error, { INTERNAL_ERROR: adminNoticeErrors.loadNotices });
    if (aptsRes.error) throw toDatabaseAppError(aptsRes.error, { INTERNAL_ERROR: adminNoticeErrors.loadUnits });
    if (residentsRes.error) throw toDatabaseAppError(residentsRes.error, { INTERNAL_ERROR: adminNoticeErrors.loadRecipients });

    const residents = (residentsRes.data || []).map((r: { id: string; full_name: string | null; email: string | null; apartments?: { apartment_number: string | null } | { apartment_number: string | null }[] | null }) => {
      const apt = Array.isArray(r.apartments) ? r.apartments[0] : r.apartments;
      return { id: r.id, full_name: r.full_name, email: r.email, unit: apt?.apartment_number ?? null };
    });

    return {
      success: true as const,
      currentUser,
      notices: (noticesRes.data || []) as NoticeRow[],
      apartments: (aptsRes.data || []) as { id: string; apartment_number: string }[],
      residents,
    };
  } catch (err) {
    await logActionError('loadAdminNoticesAction failed', err);
    return toActionError(err);
  }
}

// ── Resident ──────────────────────────────────────────────────────────────────
export async function loadMyNoticesAction() {
  try {
    const { supabase, ...currentUser } = await requireApprovedUser();
    const { data, error } = await supabase
      .from('notices')
      .select('id, batch_id, recipient_id, title, body, type, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(PAGE_LIMITS.residentNotices);
    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: residentNoticeErrors.loadNotices });
    return { success: true as const, currentUser, notices: (data || []) as NoticeRow[] };
  } catch (err) {
    await logActionError('loadMyNoticesAction failed', err);
    return toActionError(err);
  }
}

export async function markNoticeReadAction(id: string) {
  try {
    const { supabase } = await requireApprovedUser();
    const { error } = await supabase.from('notices').update({ read_at: new Date().toISOString() }).eq('id', validateUuid(id, 'notice ID')).is('read_at', null);
    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: residentNoticeErrors.markRead });
    return { success: true as const };
  } catch (err) {
    await logActionError('markNoticeReadAction failed', err);
    return toActionError(err);
  }
}

export async function markAllNoticesReadAction() {
  try {
    const { supabase, userId } = await requireApprovedUser();
    const { error } = await supabase.from('notices').update({ read_at: new Date().toISOString() }).eq('recipient_id', userId).is('read_at', null);
    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: residentNoticeErrors.markAllRead });
    return { success: true as const };
  } catch (err) {
    await logActionError('markAllNoticesReadAction failed', err);
    return toActionError(err);
  }
}
