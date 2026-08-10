// Title: Parking Issue Actions Test
// Path: src/actions/issues.test.ts
// Functionality: Unit coverage for admin parking issue action delegation and error handling.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  logActionError: vi.fn(),
  requireAdmin: vi.fn(),
  updateIssueStatus: vi.fn(),
}));

vi.mock('@/lib/action-logger', () => ({
  logActionError: mocks.logActionError,
}));

vi.mock('@/lib/auth', () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock('@/services/ParkingIssueService', () => ({
  ParkingIssueService: {
    updateStatus: mocks.updateIssueStatus,
  },
}));

import { updateParkingIssueStatusAction } from './issues';

const adminId = '11111111-1111-4111-8111-111111111111';
const issueId = '22222222-2222-4222-8222-222222222222';

function setupAdmin() {
  const supabase = {};
  mocks.requireAdmin.mockResolvedValue({ supabase, userId: adminId });
  mocks.updateIssueStatus.mockResolvedValue(undefined);
  mocks.logActionError.mockResolvedValue(undefined);
  return { supabase };
}

describe('parking issue actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates status updates through the parking issue service', async () => {
    const { supabase } = setupAdmin();

    await expect(updateParkingIssueStatusAction(issueId, 'in_progress', 'Investigating'))
      .resolves.toEqual({ success: true });

    expect(mocks.updateIssueStatus).toHaveBeenCalledWith(supabase, {
      issueId,
      status: 'in_progress',
      note: 'Investigating',
      actorId: adminId,
    });
  });

  it('returns a safe error when the service rejects the transition', async () => {
    setupAdmin();
    mocks.updateIssueStatus.mockRejectedValue(new AppError('VALIDATION_ERROR', 'Resolution note is required.'));

    await expect(updateParkingIssueStatusAction(issueId, 'resolved', ''))
      .resolves.toEqual({
        success: false,
        error: 'Resolution note is required.',
        code: 'VALIDATION_ERROR',
      });
  });
});
