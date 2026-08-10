// Title: Quick Approve Actions Test
// Path: src/actions/quick-approve.test.ts
// Functionality: Unit coverage for account approval action delegation and bulk approval validation.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  approveAndAssign: vi.fn(),
  bulkApproveAndAssign: vi.fn(),
  changeAccountStatus: vi.fn(),
  logActionError: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock('@/lib/action-logger', () => ({
  logActionError: mocks.logActionError,
}));

vi.mock('@/lib/auth', () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock('@/services/UserService', () => ({
  UserService: {
    approveAndAssign: mocks.approveAndAssign,
    bulkApproveAndAssign: mocks.bulkApproveAndAssign,
    changeAccountStatus: mocks.changeAccountStatus,
  },
}));

import { approveAndAssignUnitAction, bulkApproveAndAssignUnitsAction } from './quick-approve';

const adminId = '11111111-1111-4111-8111-111111111111';
const targetUserId = '22222222-2222-4222-8222-222222222222';
const apartmentId = '33333333-3333-4333-8333-333333333333';

function setupAdmin() {
  const supabase = {};
  mocks.requireAdmin.mockResolvedValue({ supabase, userId: adminId });
  mocks.approveAndAssign.mockResolvedValue(undefined);
  mocks.bulkApproveAndAssign.mockResolvedValue(undefined);
  mocks.changeAccountStatus.mockResolvedValue(undefined);
  mocks.logActionError.mockResolvedValue(undefined);
  return { supabase };
}

describe('quick approve actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates approve-and-assign through UserService', async () => {
    const { supabase } = setupAdmin();

    await expect(approveAndAssignUnitAction(targetUserId, apartmentId, 'Approved by staff'))
      .resolves.toEqual({ success: true });

    expect(mocks.approveAndAssign).toHaveBeenCalledWith(
      supabase,
      targetUserId,
      apartmentId,
      'Approved by staff',
      adminId,
    );
  });

  it('delegates approval without apartment through UserService status change', async () => {
    const { supabase } = setupAdmin();

    await expect(approveAndAssignUnitAction(targetUserId, null, 'Approved by staff'))
      .resolves.toEqual({ success: true });

    expect(mocks.changeAccountStatus).toHaveBeenCalledWith(
      supabase,
      targetUserId,
      'approved',
      'Approved by staff',
      adminId,
    );
  });

  it('delegates bulk approve-and-assign through UserService after validating targets', async () => {
    const { supabase } = setupAdmin();

    await expect(bulkApproveAndAssignUnitsAction([
      { targetUserId, apartmentId },
      { targetUserId: '44444444-4444-4444-8444-444444444444', apartmentId: null },
    ], 'Bulk approval'))
      .resolves.toEqual({ success: true });

    expect(mocks.bulkApproveAndAssign).toHaveBeenCalledWith(supabase, [
      { targetUserId, apartmentId },
      { targetUserId: '44444444-4444-4444-8444-444444444444', apartmentId: null },
    ], 'Bulk approval');
  });

  it('returns a safe action error when bulk approval is rejected by the service', async () => {
    setupAdmin();
    mocks.bulkApproveAndAssign.mockRejectedValue(new AppError('RULE_VIOLATION', 'Bulk approval rejected.'));

    await expect(bulkApproveAndAssignUnitsAction([{ targetUserId, apartmentId }], 'Bulk approval'))
      .resolves.toEqual({
        success: false,
        error: 'Bulk approval rejected.',
        code: 'RULE_VIOLATION',
      });

    expect(mocks.logActionError).toHaveBeenCalledWith('bulkApproveAndAssignUnitsAction failed', expect.any(AppError));
  });
});
