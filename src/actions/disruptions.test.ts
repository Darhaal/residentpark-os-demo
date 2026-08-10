// Title: Disruptions Actions Test
// Path: src/actions/disruptions.test.ts
// Functionality: Unit coverage for disruption action rate-limit wiring and short-circuit behavior.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  logActionError: vi.fn(),
  requireAdmin: vi.fn(),
  createDisruption: vi.fn(),
  completeDisruption: vi.fn(),
  activate: vi.fn(),
  activateDue: vi.fn(),
  cancel: vi.fn(),
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

vi.mock('@/services/DisruptionService', () => ({
  DisruptionService: {
    create: mocks.createDisruption,
    complete: mocks.completeDisruption,
    activate: mocks.activate,
    activateDue: mocks.activateDue,
    cancel: mocks.cancel,
  },
}));

import {
  completeDisruptionAction,
  createDisruptionAction,
  activateDisruptionAction,
  activateDueDisruptionsAction,
  cancelDisruptionAction,
} from './disruptions';

const adminId = '11111111-1111-4111-8111-111111111111';
const spotId = '22222222-2222-4222-8222-222222222222';
const secondSpotId = '33333333-3333-4333-8333-333333333333';
const disruptionId = '44444444-4444-4444-8444-444444444444';

function setupAdmin() {
  const supabase = {};
  mocks.requireAdmin.mockResolvedValue({ supabase, userId: adminId });
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.createDisruption.mockResolvedValue({ blocked: 2, relocated: 1 });
  mocks.completeDisruption.mockResolvedValue({ returned: 1, unblocked: 2 });
  mocks.activate.mockResolvedValue({ blocked: 1 });
  mocks.activateDue.mockResolvedValue(3);
  mocks.cancel.mockResolvedValue(undefined);
  mocks.logActionError.mockResolvedValue(undefined);
  return { supabase };
}

describe('disruption actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces the disruption-create rate limit before creating a disruption', async () => {
    const { supabase } = setupAdmin();

    await expect(createDisruptionAction({
      spotIds: [spotId, secondSpotId],
      title: 'Garage repair',
      reason: 'Concrete work',
      startDate: '2026-07-01',
      endDate: '2026-07-03',
    })).resolves.toEqual({ success: true, meta: { blocked: 2, relocated: 1 } });

    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(supabase, 'disruption_create');
    expect(mocks.createDisruption).toHaveBeenCalledWith(
      supabase,
      [spotId, secondSpotId],
      'Garage repair',
      'Concrete work',
      '2026-07-01',
      '2026-07-03',
      adminId,
    );
    expect(mocks.enforceRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createDisruption.mock.invocationCallOrder[0],
    );
  });

  it('does not create a disruption when the create rate limit is hit', async () => {
    setupAdmin();
    mocks.enforceRateLimit.mockRejectedValue(new AppError('RATE_LIMITED', 'Please wait before creating another disruption.'));

    await expect(createDisruptionAction({
      spotIds: [spotId],
      title: 'Garage repair',
      reason: 'Concrete work',
      startDate: '2026-07-01',
      endDate: '2026-07-03',
    })).resolves.toEqual({
      success: false,
      error: 'Please wait before creating another disruption.',
      code: 'RATE_LIMITED',
    });

    expect(mocks.createDisruption).not.toHaveBeenCalled();
  });

  it('enforces the disruption-complete rate limit before completing a disruption', async () => {
    const { supabase } = setupAdmin();

    await expect(completeDisruptionAction(disruptionId))
      .resolves.toEqual({ success: true, meta: { returned: 1, unblocked: 2 } });

    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(supabase, 'disruption_complete');
    expect(mocks.completeDisruption).toHaveBeenCalledWith(supabase, disruptionId, adminId);
    expect(mocks.enforceRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.completeDisruption.mock.invocationCallOrder[0],
    );
  });

  it('does not complete a disruption when the complete rate limit is hit', async () => {
    setupAdmin();
    mocks.enforceRateLimit.mockRejectedValue(new AppError('RATE_LIMITED', 'Please wait before completing another disruption.'));

    await expect(completeDisruptionAction(disruptionId)).resolves.toEqual({
      success: false,
      error: 'Please wait before completing another disruption.',
      code: 'RATE_LIMITED',
    });

    expect(mocks.completeDisruption).not.toHaveBeenCalled();
  });

  it('activates a single scheduled disruption', async () => {
    const { supabase } = setupAdmin();
    await expect(activateDisruptionAction(disruptionId))
      .resolves.toEqual({ success: true, meta: { blocked: 1 } });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(supabase, 'disruption_activate');
    expect(mocks.activate).toHaveBeenCalledWith(supabase, disruptionId);
    expect(mocks.enforceRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.activate.mock.invocationCallOrder[0],
    );
  });

  it('does not activate a disruption when the activation rate limit is hit', async () => {
    setupAdmin();
    mocks.enforceRateLimit.mockRejectedValue(new AppError('RATE_LIMITED', 'Please wait before activating another disruption.'));

    await expect(activateDisruptionAction(disruptionId)).resolves.toEqual({
      success: false,
      error: 'Please wait before activating another disruption.',
      code: 'RATE_LIMITED',
    });

    expect(mocks.activate).not.toHaveBeenCalled();
  });

  it('activates all due disruptions', async () => {
    const { supabase } = setupAdmin();
    await expect(activateDueDisruptionsAction())
      .resolves.toEqual({ success: true, activated: 3 });
    expect(mocks.activateDue).toHaveBeenCalledWith(supabase);
  });

  it('cancels a scheduled disruption', async () => {
    const { supabase } = setupAdmin();
    await expect(cancelDisruptionAction(disruptionId))
      .resolves.toEqual({ success: true });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(supabase, 'disruption_cancel');
    expect(mocks.cancel).toHaveBeenCalledWith(supabase, disruptionId, adminId);
    expect(mocks.enforceRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cancel.mock.invocationCallOrder[0],
    );
  });

  it('does not cancel a disruption when the cancel rate limit is hit', async () => {
    setupAdmin();
    mocks.enforceRateLimit.mockRejectedValue(new AppError('RATE_LIMITED', 'Please wait before cancelling another disruption.'));

    await expect(cancelDisruptionAction(disruptionId)).resolves.toEqual({
      success: false,
      error: 'Please wait before cancelling another disruption.',
      code: 'RATE_LIMITED',
    });

    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it('returns a structured error when activation fails', async () => {
    setupAdmin();
    mocks.activate.mockRejectedValue(new AppError('NOT_FOUND', 'Disruption not found.'));
    await expect(activateDisruptionAction(disruptionId)).resolves.toEqual({
      success: false,
      error: 'Disruption not found.',
      code: 'NOT_FOUND',
    });
  });
});
