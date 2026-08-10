// Title: Invites Actions
// Path: src/actions/invites.ts
// Functionality: Next.js Server Actions for invitation workflows, validation, and persistence.

// Server actions for invitation loading and transactional mutations.

'use server';

import { FILTER_ALL, INVITATION_STATUS } from '@/config/domain';
import { PAGE_LIMITS } from '@/config/limits';
import { requireAdmin } from '@/lib/auth';
import { resolveCursor, resolvePageLimit } from '@/lib/action-validation';
import { AppError, toDatabaseAppError } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { logActionError } from '@/lib/action-logger';
import { en } from '@/localization/en';
import { InvitationService, type BulkInviteInput, type BulkInviteResult } from '@/services/InvitationService';

export type { BulkInviteInput, BulkInviteResult } from '@/services/InvitationService';

export interface InvitationDirectoryRow {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
  token: string;
  apartments: { apartment_number: string | null } | null;
}

interface LoadInvitesDirectoryParams {
  limit?: number;
  search?: string | null;
  statusFilter?: string;
  cursorCreatedAt?: string | null;
  cursorId?: string | null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return AppError.isAppError(error) ? error.message : fallback;
}

function toInviteActionError(error: unknown, fallback: string) {
  if (AppError.isAppError(error)) {
    return { success: false as const, error: error.message, code: error.code };
  }
  return { success: false as const, error: fallback, code: 'INTERNAL_ERROR' as const };
}

function normalizeInvitation(invite: {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  token: string;
  apartments: { apartment_number: string | null } | { apartment_number: string | null }[] | null;
}): InvitationDirectoryRow {
  const status = invite.status === INVITATION_STATUS.pending && new Date(invite.expires_at) < new Date()
    ? INVITATION_STATUS.expired
    : invite.status;
  const apartment = Array.isArray(invite.apartments) ? invite.apartments[0] || null : invite.apartments;

  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: status as InvitationDirectoryRow['status'],
    created_at: invite.created_at,
    expires_at: invite.expires_at,
    token: invite.token,
    apartments: apartment,
  };
}

export async function loadInvitesDirectoryAction(params: LoadInvitesDirectoryParams = {}) {
  try {
    const auth = await requireAdmin();
    const { supabase } = auth;
    const currentUser = { full_name: auth.fullName, role: auth.role };
    const limit = resolvePageLimit(params.limit, PAGE_LIMITS.invitations, PAGE_LIMITS.invitations);
    const cursor = resolveCursor(params);
    const search = params.search?.trim();
    const statusFilter = params.statusFilter || FILTER_ALL;

    let query = supabase
      .from('invitations')
      .select('id, email, role, status, created_at, expires_at, token, apartments(apartment_number)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (statusFilter === INVITATION_STATUS.expired) {
      query = query
        .eq('status', INVITATION_STATUS.pending)
        .lt('expires_at', new Date().toISOString());
    } else if (statusFilter !== FILTER_ALL) {
      query = query.eq('status', statusFilter);
    }
    if (search) {
      query = query.ilike('email', `%${search}%`);
    }
    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.cursorCreatedAt},and(created_at.eq.${cursor.cursorCreatedAt},id.lt.${cursor.cursorId})`,
      );
    }

    const { data, error } = await query;
    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: en.invitations.loadError });

    const rows = data || [];
    const hasMore = rows.length > limit;
    const invitations = rows.slice(0, limit).map(normalizeInvitation);

    return {
      success: true as const,
      currentUser,
      invitations,
      hasMore,
    };
  } catch (error) {
    await logActionError('loadInvitesDirectoryAction failed', error);
    return toInviteActionError(error, en.invitations.loadError);
  }
}

export async function processBulkInvites(invites: BulkInviteInput[]): Promise<BulkInviteResult> {
  const inputRows = Array.isArray(invites) ? invites : [];
  const result: BulkInviteResult = {
    success: false,
    totalProcessed: inputRows.length,
    successful: 0,
    failed: [],
  };

  try {
    const { supabase } = await requireAdmin();
    await enforceRateLimit(supabase, 'invite_bulk');
    return await InvitationService.bulkCreate(supabase, inputRows);
  } catch (error) {
    await logActionError('processBulkInvites failed', error);
    result.error = getErrorMessage(error, en.invitations.processError);
    return result;
  }
}

export async function revokeInviteAction(inviteId: string) {
  try {
    const { supabase } = await requireAdmin();
    await InvitationService.revoke(supabase, inviteId);
    return { success: true as const };
  } catch (error) {
    await logActionError('revokeInviteAction failed', error);
    return toInviteActionError(error, en.invitations.revokeError);
  }
}

export async function resendInviteAction(inviteId: string) {
  try {
    const { supabase } = await requireAdmin();
    await InvitationService.resend(supabase, inviteId);
    return { success: true as const };
  } catch (error) {
    await logActionError('resendInviteAction failed', error);
    return toInviteActionError(error, en.invitations.resendError);
  }
}
