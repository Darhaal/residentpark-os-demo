// Title: Event Actions Test
// Path: src/actions/events.test.ts
// Functionality: Unit coverage for incident-resolution action delegation and safe errors.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  logActionError: vi.fn(),
  requireAdmin: vi.fn(),
  resolveIncident: vi.fn(),
}));

vi.mock('@/lib/action-logger', () => ({
  logActionError: mocks.logActionError,
}));

vi.mock('@/lib/auth', () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock('@/services/EventService', () => ({
  EventService: {
    resolveIncident: mocks.resolveIncident,
  },
}));

import { resolveIncidentAction } from './events';

const eventId = '11111111-1111-4111-8111-111111111111';

function setupAdmin() {
  const supabase = {};
  mocks.requireAdmin.mockResolvedValue({ supabase });
  mocks.resolveIncident.mockResolvedValue(undefined);
  mocks.logActionError.mockResolvedValue(undefined);
  return { supabase };
}

describe('event actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates incident resolution through the event service', async () => {
    const { supabase } = setupAdmin();

    await expect(resolveIncidentAction(eventId, 'Resident contacted.'))
      .resolves.toEqual({ success: true });

    expect(mocks.resolveIncident).toHaveBeenCalledWith(supabase, {
      eventId,
      resolutionNote: 'Resident contacted.',
    });
  });

  it('returns a safe action error when the service rejects the resolution', async () => {
    setupAdmin();
    mocks.resolveIncident.mockRejectedValue(new AppError('VALIDATION_ERROR', 'Enter a resolution note.'));

    await expect(resolveIncidentAction(eventId, ''))
      .resolves.toEqual({
        success: false,
        error: 'Enter a resolution note.',
        code: 'VALIDATION_ERROR',
      });

    expect(mocks.logActionError).toHaveBeenCalledWith('Action: resolveIncidentAction failed', expect.any(AppError));
  });
});
