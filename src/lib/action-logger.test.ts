// Title: Server Action Logger Test
// Path: src/lib/action-logger.test.ts
// Functionality: Verifies request-id enrichment for Server Action logs.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
  },
}));

import { getRequestLogContext, logActionError, logActionWarn } from './action-logger';

describe('action logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds the request id from headers to log context', async () => {
    mocks.headers.mockResolvedValue({ get: () => 'req-123' });

    await expect(getRequestLogContext({ action: 'invite' })).resolves.toEqual({
      action: 'invite',
      requestId: 'req-123',
    });
  });

  it('falls back to the original context outside a request scope', async () => {
    mocks.headers.mockRejectedValue(new Error('no request scope'));

    await expect(getRequestLogContext({ action: 'invite' })).resolves.toEqual({
      action: 'invite',
    });
  });

  it('logs action errors with request metadata', async () => {
    const error = new Error('boom');
    mocks.headers.mockResolvedValue({ get: () => 'req-456' });

    await logActionError('action failed', error, { action: 'parking' });

    expect(mocks.loggerError).toHaveBeenCalledWith('action failed', error, {
      action: 'parking',
      requestId: 'req-456',
    });
  });

  it('logs action warnings with request metadata', async () => {
    mocks.headers.mockResolvedValue({ get: () => 'req-789' });

    await logActionWarn('action warning', { action: 'users' });

    expect(mocks.loggerWarn).toHaveBeenCalledWith('action warning', {
      action: 'users',
      requestId: 'req-789',
    });
  });
});
