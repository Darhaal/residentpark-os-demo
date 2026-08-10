// Title: Invitation Service Test
// Path: src/services/InvitationService.test.ts
// Functionality: Unit coverage for typed invitation RPC adapters and bulk result parsing.

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INVITATION_CONFIG } from '@/config/limits';
import { InvitationService } from './InvitationService';

const apartmentId = '11111111-1111-4111-8111-111111111111';
const inviteId = '22222222-2222-4222-8222-222222222222';

function supabaseWithRpc(rpc = vi.fn()) {
  return { rpc } as unknown as SupabaseClient;
}

describe('InvitationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a single invitation through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: inviteId, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(InvitationService.createInvitation(supabase, {
      apartmentId: ` ${apartmentId} `,
      email: ' Resident@Example.com ',
    })).resolves.toBe(inviteId);

    expect(rpc).toHaveBeenCalledWith('tx_create_invitation', {
      p_email: 'resident@example.com',
      p_apartment_id: apartmentId,
      p_expiration_days: INVITATION_CONFIG.expirationDays,
    });
  });

  it('rejects invalid single invitation email before calling the database', async () => {
    const rpc = vi.fn();
    const supabase = supabaseWithRpc(rpc);

    await expect(InvitationService.createInvitation(supabase, {
      apartmentId,
      email: 'not-an-email',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Enter a valid email address.',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('bulk creates invitations and translates per-row failures', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        successful: 1,
        failed: [
          { email: 'bad', apartmentNumber: 'A-404', code: 'invalid_email' },
          { email: 'missing@example.com', apartmentNumber: 'Z-999', code: 'apartment_not_found' },
        ],
      },
      error: null,
    });
    const supabase = supabaseWithRpc(rpc);

    await expect(InvitationService.bulkCreate(supabase, [
      { email: ' First@Example.com ', apartmentNumber: ' a-101 ' },
      { email: 'bad', apartmentNumber: 'A-404' },
      { email: 'missing@example.com', apartmentNumber: 'z-999' },
    ])).resolves.toEqual({
      success: true,
      totalProcessed: 3,
      successful: 1,
      failed: [
        { email: 'bad', reason: 'Enter a valid email address.' },
        { email: 'missing@example.com', reason: "Apartment 'Z-999' not found in system" },
      ],
    });

    expect(rpc).toHaveBeenCalledWith('tx_bulk_create_invitations', {
      p_invitations: [
        { email: 'first@example.com', apartmentNumber: 'A-101' },
        { email: 'bad', apartmentNumber: 'A-404' },
        { email: 'missing@example.com', apartmentNumber: 'Z-999' },
      ],
      p_expiration_days: INVITATION_CONFIG.expirationDays,
    });
  });

  it('rejects invalid bulk RPC result shapes', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { successful: '1', failed: [] }, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(InvitationService.bulkCreate(supabase, [
      { email: 'first@example.com', apartmentNumber: 'A-101' },
    ])).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Failed to process invitations.',
    });
  });

  it('revokes invitations through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(InvitationService.revoke(supabase, ` ${inviteId} `)).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_revoke_invitation', {
      p_invitation_id: inviteId,
    });
  });

  it('maps accepted revoke failures to the invitation workflow message', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'RULE: accepted invitation cannot be revoked' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(InvitationService.revoke(supabase, inviteId)).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
      message: 'An accepted invitation cannot be revoked.',
    });
  });

  it('refreshes invitation links through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(InvitationService.resend(supabase, inviteId)).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_resend_invitation', {
      p_invitation_id: inviteId,
      p_expiration_days: INVITATION_CONFIG.expirationDays,
    });
  });
});
