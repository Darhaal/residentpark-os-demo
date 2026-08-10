// Title: Invites Actions Test
// Path: src/actions/invites.test.ts
// Functionality: Unit coverage for invitation action rate-limit wiring and short-circuit behavior.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  logActionError: vi.fn(),
  requireAdmin: vi.fn(),
  bulkCreate: vi.fn(),
  revoke: vi.fn(),
  resend: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/lib/action-logger', () => ({
  logActionError: mocks.logActionError,
}));

vi.mock('@/lib/auth', () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock('@/services/InvitationService', () => ({
  InvitationService: {
    bulkCreate: mocks.bulkCreate,
    revoke: mocks.revoke,
    resend: mocks.resend,
  },
}));

import { processBulkInvites, resendInviteAction, revokeInviteAction } from './invites';

const inviteId = '11111111-1111-4111-8111-111111111111';

function setupAdmin() {
  const supabase = {};
  mocks.requireAdmin.mockResolvedValue({ supabase });
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.bulkCreate.mockResolvedValue({
    success: true,
    totalProcessed: 2,
    successful: 2,
    failed: [],
  });
  mocks.revoke.mockResolvedValue(undefined);
  mocks.resend.mockResolvedValue(undefined);
  mocks.logActionError.mockResolvedValue(undefined);
  return { supabase };
}

describe('invites actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces the bulk invite rate limit before creating invitations', async () => {
    const { supabase } = setupAdmin();
    const input = [
      { email: ' First@Example.com ', apartmentNumber: ' a-101 ' },
      { email: 'second@example.com', apartmentNumber: 'b-202' },
    ];

    await expect(processBulkInvites(input)).resolves.toEqual({
      success: true,
      totalProcessed: 2,
      successful: 2,
      failed: [],
    });

    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(supabase, 'invite_bulk');
    expect(mocks.bulkCreate).toHaveBeenCalledWith(supabase, input);
    expect(mocks.enforceRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.bulkCreate.mock.invocationCallOrder[0],
    );
  });

  it('does not create invitations when the bulk invite rate limit is hit', async () => {
    setupAdmin();
    mocks.enforceRateLimit.mockRejectedValue(new AppError('RATE_LIMITED', 'Please wait before importing more invitations.'));

    await expect(processBulkInvites([
      { email: 'first@example.com', apartmentNumber: 'A-101' },
    ])).resolves.toEqual({
      success: false,
      totalProcessed: 1,
      successful: 0,
      failed: [],
      error: 'Please wait before importing more invitations.',
    });

    expect(mocks.bulkCreate).not.toHaveBeenCalled();
  });

  it('delegates revoke through the invitation service', async () => {
    const { supabase } = setupAdmin();

    await expect(revokeInviteAction(inviteId)).resolves.toEqual({ success: true });

    expect(mocks.revoke).toHaveBeenCalledWith(supabase, inviteId);
  });

  it('returns a safe action error when revoke is rejected by the service', async () => {
    setupAdmin();
    mocks.revoke.mockRejectedValue(new AppError('RULE_VIOLATION', 'An accepted invitation cannot be revoked.'));

    await expect(revokeInviteAction(inviteId)).resolves.toEqual({
      success: false,
      error: 'An accepted invitation cannot be revoked.',
      code: 'RULE_VIOLATION',
    });
  });

  it('delegates resend through the invitation service', async () => {
    const { supabase } = setupAdmin();

    await expect(resendInviteAction(inviteId)).resolves.toEqual({ success: true });

    expect(mocks.resend).toHaveBeenCalledWith(supabase, inviteId);
  });
});
