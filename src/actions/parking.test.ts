// Title: Parking Actions Test
// Path: src/actions/parking.test.ts
// Functionality: Unit coverage for parking and vehicle action rate-limit wiring.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  logActionError: vi.fn(),
  requireAdmin: vi.fn(),
  bulkReviewVehicles: vi.fn(),
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

vi.mock('@/services/VehicleService', () => ({
  VehicleService: {
    bulkReviewVehicles: mocks.bulkReviewVehicles,
  },
}));

import { bulkReviewVehiclesAction } from './parking';

const adminId = '11111111-1111-4111-8111-111111111111';
const vehicleId = '22222222-2222-4222-8222-222222222222';
const secondVehicleId = '33333333-3333-4333-8333-333333333333';

function setupAdmin() {
  const supabase = {};
  mocks.requireAdmin.mockResolvedValue({ supabase, userId: adminId });
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.bulkReviewVehicles.mockResolvedValue(undefined);
  mocks.logActionError.mockResolvedValue(undefined);
  return { supabase };
}

describe('parking actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces the vehicle bulk rate limit before reviewing vehicles', async () => {
    const { supabase } = setupAdmin();

    await expect(bulkReviewVehiclesAction([vehicleId, secondVehicleId], 'approved', 'Bulk approval'))
      .resolves.toEqual({ success: true });

    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(supabase, 'vehicle_bulk');
    expect(mocks.bulkReviewVehicles).toHaveBeenCalledWith(
      supabase,
      [vehicleId, secondVehicleId],
      'approved',
      'Bulk approval',
      adminId,
    );
    expect(mocks.enforceRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.bulkReviewVehicles.mock.invocationCallOrder[0],
    );
  });

  it('does not review vehicles when the vehicle bulk rate limit is hit', async () => {
    setupAdmin();
    mocks.enforceRateLimit.mockRejectedValue(new AppError('RATE_LIMITED', 'Please wait before another vehicle bulk review.'));

    await expect(bulkReviewVehiclesAction([vehicleId], 'rejected', 'Duplicate request'))
      .resolves.toEqual({
        success: false,
        error: 'Please wait before another vehicle bulk review.',
        code: 'RATE_LIMITED',
      });

    expect(mocks.bulkReviewVehicles).not.toHaveBeenCalled();
  });
});
