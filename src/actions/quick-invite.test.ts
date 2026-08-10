// Title: Quick Invite Actions Test
// Path: src/actions/quick-invite.test.ts
// Functionality: Unit coverage for single-apartment invitation action delegation and safe errors.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  createInvitation: vi.fn(),
  logActionError: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock('@/lib/action-logger', () => ({
  logActionError: mocks.logActionError,
}));

vi.mock('@/lib/auth', () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock('@/services/InvitationService', () => ({
  InvitationService: {
    createInvitation: mocks.createInvitation,
  },
}));

import { quickInviteToApartmentAction } from './quick-invite';

const apartmentId = '11111111-1111-4111-8111-111111111111';

function setupAdmin() {
  const supabase = {};
  mocks.requireAdmin.mockResolvedValue({ supabase });
  mocks.createInvitation.mockResolvedValue('22222222-2222-4222-8222-222222222222');
  mocks.logActionError.mockResolvedValue(undefined);
  return { supabase };
}

describe('quick invite action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates single-apartment invitations through the invitation service', async () => {
    const { supabase } = setupAdmin();

    await expect(quickInviteToApartmentAction(apartmentId, ' resident@example.com '))
      .resolves.toEqual({ success: true });

    expect(mocks.createInvitation).toHaveBeenCalledWith(supabase, {
      apartmentId,
      email: ' resident@example.com ',
    });
  });

  it('returns a safe action error when the service rejects the invitation', async () => {
    setupAdmin();
    mocks.createInvitation.mockRejectedValue(new AppError('CONFLICT', 'An active invitation is already pending for this email.'));

    await expect(quickInviteToApartmentAction(apartmentId, 'resident@example.com'))
      .resolves.toEqual({
        success: false,
        error: 'An active invitation is already pending for this email.',
        code: 'CONFLICT',
      });

    expect(mocks.logActionError).toHaveBeenCalledWith('quickInviteToApartmentAction failed', expect.any(AppError));
  });
});
