// Title: User Actions Test
// Path: src/actions/users.test.ts
// Functionality: Unit coverage for user-management action rate-limit wiring and short-circuit behavior.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  createStatelessClient: vi.fn(),
  headers: vi.fn(),
  enforceRateLimit: vi.fn(),
  logActionError: vi.fn(),
  logActionWarn: vi.fn(),
  requireAdmin: vi.fn(),
  provisionCreatedAccount: vi.fn(),
  bulkChangeAccountStatus: vi.fn(),
  bulkUpdatePermissions: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createStatelessClient,
}));

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/lib/action-logger', () => ({
  logActionError: mocks.logActionError,
  logActionWarn: mocks.logActionWarn,
}));

vi.mock('@/lib/auth', () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock('@/services/UserService', () => ({
  UserService: {
    provisionCreatedAccount: mocks.provisionCreatedAccount,
    bulkChangeAccountStatus: mocks.bulkChangeAccountStatus,
    bulkUpdatePermissions: mocks.bulkUpdatePermissions,
  },
}));

import {
  bulkUpdatePermissionsAction,
  bulkUpdateUserStatusAction,
  createUserAccountAction,
} from './users';

const adminId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const secondTargetId = '33333333-3333-4333-8333-333333333333';

function setupAdmin() {
  const supabase = {};
  mocks.requireAdmin.mockResolvedValue({
    supabase,
    userId: adminId,
    email: 'admin@example.com',
    role: 'admin',
  });
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.logActionError.mockResolvedValue(undefined);
  mocks.logActionWarn.mockResolvedValue(undefined);
  mocks.bulkChangeAccountStatus.mockResolvedValue(undefined);
  mocks.bulkUpdatePermissions.mockResolvedValue(undefined);
  return { supabase };
}

describe('user actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stops account creation before provisioning when the account-create limit is hit', async () => {
    setupAdmin();
    mocks.enforceRateLimit.mockRejectedValue(new AppError('RATE_LIMITED', 'Please wait before creating another account.'));

    await expect(createUserAccountAction({
      fullName: 'Resident One',
      email: 'resident@example.com',
      confirmAdminPassword: '',
      role: 'resident',
      apartmentId: targetId,
    })).resolves.toEqual({
      success: false,
      error: 'Please wait before creating another account.',
      code: 'RATE_LIMITED',
    });

    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(expect.anything(), 'account_create');
    expect(mocks.createStatelessClient).not.toHaveBeenCalled();
    expect(mocks.headers).not.toHaveBeenCalled();
    expect(mocks.provisionCreatedAccount).not.toHaveBeenCalled();
  });

  it('enforces the user bulk limit before changing account statuses', async () => {
    const { supabase } = setupAdmin();

    await expect(bulkUpdateUserStatusAction([targetId, secondTargetId], 'suspended', 'Bulk suspension'))
      .resolves.toEqual({ success: true });

    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(supabase, 'user_bulk');
    expect(mocks.bulkChangeAccountStatus).toHaveBeenCalledWith(
      supabase,
      [targetId, secondTargetId],
      'suspended',
      'Bulk suspension',
      adminId,
    );
    expect(mocks.enforceRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.bulkChangeAccountStatus.mock.invocationCallOrder[0],
    );
  });

  it('does not change statuses when the user bulk limit is hit', async () => {
    setupAdmin();
    mocks.enforceRateLimit.mockRejectedValue(new AppError('RATE_LIMITED', 'Please wait before another bulk update.'));

    await expect(bulkUpdateUserStatusAction([targetId], 'suspended', 'Bulk suspension'))
      .resolves.toEqual({
        success: false,
        error: 'Please wait before another bulk update.',
        code: 'RATE_LIMITED',
      });

    expect(mocks.bulkChangeAccountStatus).not.toHaveBeenCalled();
  });

  it('enforces the user bulk limit before changing permissions', async () => {
    const { supabase } = setupAdmin();

    await expect(bulkUpdatePermissionsAction([targetId, secondTargetId], 'resident', 'Bulk role cleanup'))
      .resolves.toEqual({ success: true });

    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(supabase, 'user_bulk');
    expect(mocks.bulkUpdatePermissions).toHaveBeenCalledWith(
      supabase,
      [targetId, secondTargetId],
      'resident',
      'Bulk role cleanup',
      adminId,
    );
    expect(mocks.enforceRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.bulkUpdatePermissions.mock.invocationCallOrder[0],
    );
  });

  it('does not change permissions when the user bulk limit is hit', async () => {
    setupAdmin();
    mocks.enforceRateLimit.mockRejectedValue(new AppError('RATE_LIMITED', 'Please wait before another bulk update.'));

    await expect(bulkUpdatePermissionsAction([targetId], 'resident', 'Bulk role cleanup'))
      .resolves.toEqual({
        success: false,
        error: 'Please wait before another bulk update.',
        code: 'RATE_LIMITED',
      });

    expect(mocks.bulkUpdatePermissions).not.toHaveBeenCalled();
  });
});
