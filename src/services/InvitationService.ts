// Title: Invitation Domain Service
// Path: src/services/InvitationService.ts
// Functionality: Typed adapters for invitation creation, bulk import, revoke, and resend RPCs.

import type { SupabaseClient } from '@supabase/supabase-js';
import { BULK_ACTION_LIMITS, INVITATION_CONFIG } from '@/config/limits';
import { validateBulkSize, validateUuid } from '@/lib/action-validation';
import { AppError, toDatabaseAppError } from '@/lib/errors';
import { en } from '@/localization/en';

export interface BulkInviteInput {
  email: string;
  apartmentNumber: string;
  role?: string;
}

export interface BulkInviteResult {
  success: boolean;
  totalProcessed: number;
  successful: number;
  failed: { email: string; reason: string }[];
  error?: string;
}

interface BulkInviteRpcFailure {
  email?: string;
  apartmentNumber?: string;
  code?: string;
}

interface BulkInviteRpcResult {
  successful: number;
  failed: BulkInviteRpcFailure[];
}

interface CreateInvitationParams {
  apartmentId: string;
  email: string;
}

const messages = en.invitations;
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function parseEmail(email: unknown) {
  const cleanEmail = normalizeEmail(email);
  if (!emailPattern.test(cleanEmail)) {
    throw new AppError('VALIDATION_ERROR', messages.invalidEmail);
  }
  return cleanEmail;
}

function bulkFailureReason(failure: BulkInviteRpcFailure) {
  switch (failure.code) {
    case 'invalid_email':
      return messages.invalidEmail;
    case 'invalid_apartment_number':
      return messages.invalidApartmentNumber;
    case 'apartment_not_found':
      return messages.apartmentNotFound(failure.apartmentNumber || '');
    case 'duplicate_pending':
      return messages.pendingAlreadyExists;
    default:
      return messages.processError;
  }
}

function parseBulkResult(data: unknown): BulkInviteRpcResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new AppError('INTERNAL_ERROR', messages.processError);
  }

  const result = data as { successful?: unknown; failed?: unknown };
  if (typeof result.successful !== 'number' || !Array.isArray(result.failed)) {
    throw new AppError('INTERNAL_ERROR', messages.processError);
  }

  return {
    successful: result.successful,
    failed: result.failed as BulkInviteRpcFailure[],
  };
}

function invitationMutationError(error: unknown, fallback: string, ruleMessage?: string) {
  return toDatabaseAppError(error, {
    NOT_FOUND: messages.invitationNotFound,
    CONFLICT: messages.activeInvitationExists,
    RULE_VIOLATION: ruleMessage ?? fallback,
    INTERNAL_ERROR: fallback,
  });
}

export class InvitationService {
  static async createInvitation(supabase: SupabaseClient, params: CreateInvitationParams): Promise<string> {
    const cleanEmail = parseEmail(params.email);
    const apartmentId = validateUuid(params.apartmentId, 'apartment ID');

    const { data, error } = await supabase.rpc('tx_create_invitation', {
      p_email: cleanEmail,
      p_apartment_id: apartmentId,
      p_expiration_days: INVITATION_CONFIG.expirationDays,
    });

    if (error) {
      throw toDatabaseAppError(error, {
        CONFLICT: messages.activeInvitationExists,
        NOT_FOUND: messages.targetApartmentNotFound,
        VALIDATION_ERROR: messages.invalidEmail,
        INTERNAL_ERROR: messages.dbCreateError,
      });
    }

    if (typeof data !== 'string' || !data) {
      throw new AppError('INTERNAL_ERROR', messages.dbCreateError);
    }

    return data;
  }

  static async bulkCreate(supabase: SupabaseClient, invites: BulkInviteInput[]): Promise<BulkInviteResult> {
    const inputRows = Array.isArray(invites) ? invites : [];
    validateBulkSize(inputRows, BULK_ACTION_LIMITS.invitationRows, 'invitation rows');

    const payload = inputRows.map(invite => ({
      email: normalizeEmail(invite.email),
      apartmentNumber: typeof invite.apartmentNumber === 'string' ? invite.apartmentNumber.trim().toUpperCase() : '',
    }));

    const { data, error } = await supabase.rpc('tx_bulk_create_invitations', {
      p_invitations: payload,
      p_expiration_days: INVITATION_CONFIG.expirationDays,
    });

    if (error) {
      throw toDatabaseAppError(error, { INTERNAL_ERROR: messages.dbCreateError });
    }

    const rpcResult = parseBulkResult(data);
    return {
      success: true,
      totalProcessed: inputRows.length,
      successful: rpcResult.successful,
      failed: rpcResult.failed.map(failure => ({
        email: failure.email || '',
        reason: bulkFailureReason(failure),
      })),
    };
  }

  static async revoke(supabase: SupabaseClient, inviteId: string): Promise<void> {
    const { error } = await supabase.rpc('tx_revoke_invitation', {
      p_invitation_id: validateUuid(inviteId, 'invitation ID'),
    });

    if (error) {
      throw invitationMutationError(error, messages.revokeError, messages.acceptedCannotRevoke);
    }
  }

  static async resend(supabase: SupabaseClient, inviteId: string): Promise<void> {
    const { error } = await supabase.rpc('tx_resend_invitation', {
      p_invitation_id: validateUuid(inviteId, 'invitation ID'),
      p_expiration_days: INVITATION_CONFIG.expirationDays,
    });

    if (error) {
      throw invitationMutationError(error, messages.resendError, messages.acceptedCannotResend);
    }
  }
}
