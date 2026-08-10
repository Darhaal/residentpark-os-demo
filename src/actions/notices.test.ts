// Title: Notices Actions Test
// Path: src/actions/notices.test.ts
// Functionality: Unit coverage for notice send rate-limit wiring and short-circuit behavior.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  logActionError: vi.fn(),
  requireAdmin: vi.fn(),
  sendNotice: vi.fn(),
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

vi.mock('@/services/NoticeService', () => ({
  NoticeService: {
    sendNotice: mocks.sendNotice,
  },
}));

import { sendNoticeAction } from './notices';

function setupAdmin() {
  const supabase = {};
  mocks.requireAdmin.mockResolvedValue({ supabase });
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.sendNotice.mockResolvedValue({ batch_id: 'batch-1', count: 12 });
  mocks.logActionError.mockResolvedValue(undefined);
  return { supabase };
}

describe('notices actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces the notice-send rate limit before sending notices', async () => {
    const { supabase } = setupAdmin();
    const input = {
      audience: 'all' as const,
      title: 'Garage update',
      body: 'Please move vehicles by 8 AM.',
      type: 'announcement' as const,
    };

    await expect(sendNoticeAction(input)).resolves.toEqual({
      success: true,
      meta: { batch_id: 'batch-1', count: 12 },
    });

    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(supabase, 'notice_send');
    expect(mocks.sendNotice).toHaveBeenCalledWith(supabase, input);
    expect(mocks.enforceRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sendNotice.mock.invocationCallOrder[0],
    );
  });

  it('does not send notices when the notice-send rate limit is hit', async () => {
    setupAdmin();
    mocks.enforceRateLimit.mockRejectedValue(new AppError('RATE_LIMITED', 'Please wait before sending another notice.'));

    await expect(sendNoticeAction({
      audience: 'all',
      title: 'Garage update',
      body: 'Please move vehicles by 8 AM.',
      type: 'announcement',
    })).resolves.toEqual({
      success: false,
      error: 'Please wait before sending another notice.',
      code: 'RATE_LIMITED',
    });

    expect(mocks.sendNotice).not.toHaveBeenCalled();
  });
});
