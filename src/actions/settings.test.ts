// Title: Settings Actions Test
// Path: src/actions/settings.test.ts
// Functionality: Unit coverage for portal-banner action delegation and safe error handling.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  logActionError: vi.fn(),
  requireAdmin: vi.fn(),
  updatePortalNotice: vi.fn(),
}));

vi.mock('@/lib/action-logger', () => ({
  logActionError: mocks.logActionError,
}));

vi.mock('@/lib/auth', () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock('@/services/SettingsService', () => ({
  SettingsService: {
    updatePortalNotice: mocks.updatePortalNotice,
  },
}));

import { updatePortalNoticeAction } from './settings';

const adminId = '11111111-1111-4111-8111-111111111111';

function setupAdmin() {
  const supabase = {};
  mocks.requireAdmin.mockResolvedValue({ supabase, userId: adminId });
  mocks.updatePortalNotice.mockResolvedValue(undefined);
  mocks.logActionError.mockResolvedValue(undefined);
  return { supabase };
}

describe('settings actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates portal notice updates through the settings service', async () => {
    const { supabase } = setupAdmin();

    await expect(updatePortalNoticeAction('  Garage cleaning tonight.  '))
      .resolves.toEqual({ success: true });

    expect(mocks.updatePortalNotice).toHaveBeenCalledWith(supabase, {
      notice: '  Garage cleaning tonight.  ',
      actorId: adminId,
    });
  });

  it('returns a safe action error when the service rejects the update', async () => {
    setupAdmin();
    mocks.updatePortalNotice.mockRejectedValue(new AppError('FORBIDDEN', 'You do not have permission to perform this action.'));

    await expect(updatePortalNoticeAction('Garage cleaning tonight.'))
      .resolves.toEqual({
        success: false,
        error: 'You do not have permission to perform this action.',
        code: 'FORBIDDEN',
      });

    expect(mocks.logActionError).toHaveBeenCalledWith('updatePortalNoticeAction failed', expect.any(AppError));
  });
});
