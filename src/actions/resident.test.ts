// Title: Resident Actions Test
// Path: src/actions/resident.test.ts
// Functionality: Unit coverage for resident action rate-limit wiring and short-circuit behavior.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  logActionError: vi.fn(),
  requireApprovedUser: vi.fn(),
  submitVehicleRequest: vi.fn(),
  reportParkingIssue: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/lib/action-logger', () => ({
  logActionError: mocks.logActionError,
}));

vi.mock('@/lib/auth', () => ({
  requireApprovedUser: mocks.requireApprovedUser,
}));

vi.mock('@/services/VehicleService', () => ({
  VehicleService: {
    submitRequest: mocks.submitVehicleRequest,
  },
}));

vi.mock('@/services/ParkingIssueService', () => ({
  ParkingIssueService: {
    reportIssue: mocks.reportParkingIssue,
  },
}));

import { reportParkingIssueAction, submitResidentVehicleAction } from './resident';

const userId = '11111111-1111-4111-8111-111111111111';
const apartmentId = '22222222-2222-4222-8222-222222222222';
const spotId = '33333333-3333-4333-8333-333333333333';

function setupApprovedUser() {
  const supabase = {};
  mocks.requireApprovedUser.mockResolvedValue({ supabase, userId, apartmentId });
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.submitVehicleRequest.mockResolvedValue(undefined);
  mocks.reportParkingIssue.mockResolvedValue('44444444-4444-4444-8444-444444444444');
  mocks.logActionError.mockResolvedValue(undefined);
  return { supabase };
}

describe('resident actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces the vehicle submission rate limit before submitting the vehicle request', async () => {
    const { supabase } = setupApprovedUser();

    await expect(submitResidentVehicleAction({
      plateNumber: 'ABC123',
      make: 'Toyota',
      model: 'Camry',
      color: 'Blue',
      year: 2024,
    })).resolves.toEqual({ success: true });

    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(supabase, 'vehicle_submit');
    expect(mocks.submitVehicleRequest).toHaveBeenCalledWith(
      supabase,
      apartmentId,
      userId,
      'ABC123',
      'Toyota',
      'Camry',
      'Blue',
      2024,
      userId,
    );
    expect(mocks.enforceRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.submitVehicleRequest.mock.invocationCallOrder[0],
    );
  });

  it('does not submit a vehicle request when the vehicle rate limit is hit', async () => {
    setupApprovedUser();
    mocks.enforceRateLimit.mockRejectedValue(new AppError('RATE_LIMITED', 'Please wait before submitting another vehicle.'));

    await expect(submitResidentVehicleAction({
      plateNumber: 'ABC123',
      make: 'Toyota',
      model: 'Camry',
      color: 'Blue',
      year: 2024,
    })).resolves.toEqual({
      success: false,
      error: 'Please wait before submitting another vehicle.',
      code: 'RATE_LIMITED',
    });

    expect(mocks.submitVehicleRequest).not.toHaveBeenCalled();
  });

  it('enforces the issue-report rate limit before calling the reporting RPC', async () => {
    const { supabase } = setupApprovedUser();

    await expect(reportParkingIssueAction(spotId, 'A-12', 'unauthorized_vehicle', 'XYZ999', 'Blocking access'))
      .resolves.toEqual({ success: true });

    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(supabase, 'issue_report');
    expect(mocks.reportParkingIssue).toHaveBeenCalledWith(supabase, {
      spotId,
      issueType: 'unauthorized_vehicle',
      violatingPlate: 'XYZ999',
      comment: 'Blocking access',
      actorId: userId,
    });
    expect(mocks.enforceRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reportParkingIssue.mock.invocationCallOrder[0],
    );
  });

  it('does not call the reporting RPC when the issue-report rate limit is hit', async () => {
    setupApprovedUser();
    mocks.enforceRateLimit.mockRejectedValue(new AppError('RATE_LIMITED', 'Please wait before reporting another issue.'));

    await expect(reportParkingIssueAction(spotId, 'A-12', 'unauthorized_vehicle', 'XYZ999', 'Blocking access'))
      .resolves.toEqual({
        success: false,
        error: 'Please wait before reporting another issue.',
        code: 'RATE_LIMITED',
      });

    expect(mocks.reportParkingIssue).not.toHaveBeenCalled();
  });

  it('does not rate-limit or call the issue-report RPC when the resident is not approved', async () => {
    mocks.requireApprovedUser.mockRejectedValue(new AppError('FORBIDDEN', 'Account is pending approval or suspended.'));
    mocks.logActionError.mockResolvedValue(undefined);

    await expect(reportParkingIssueAction(spotId, 'A-12', 'unauthorized_vehicle', 'XYZ999', 'Blocking access'))
      .resolves.toEqual({
        success: false,
        error: 'Account is pending approval or suspended.',
        code: 'FORBIDDEN',
      });

    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.reportParkingIssue).not.toHaveBeenCalled();
  });
});
