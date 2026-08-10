// Title: Request Logger Test
// Path: src/lib/request-logger.test.ts
// Functionality: Unit coverage for request-id enrichment in server-side logs.

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

import { getRequestLogContext, logRequestError, logRequestWarn } from './request-logger';

describe('request logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds the request id from headers to log context', async () => {
    mocks.headers.mockResolvedValue({ get: () => 'req-123' });

    await expect(getRequestLogContext({ route: '/' })).resolves.toEqual({
      route: '/',
      requestId: 'req-123',
    });
  });

  it('falls back to the original context outside a request scope', async () => {
    mocks.headers.mockRejectedValue(new Error('no request scope'));

    await expect(getRequestLogContext({ route: '/' })).resolves.toEqual({
      route: '/',
    });
  });

  it('logs request errors with request metadata', async () => {
    const error = new Error('boom');
    mocks.headers.mockResolvedValue({ get: () => 'req-456' });

    await logRequestError('route failed', error, { route: '/parking' });

    expect(mocks.loggerError).toHaveBeenCalledWith('route failed', error, {
      route: '/parking',
      requestId: 'req-456',
    });
  });

  it('logs request warnings with request metadata', async () => {
    mocks.headers.mockResolvedValue({ get: () => 'req-789' });

    await logRequestWarn('route degraded', { route: '/parking' });

    expect(mocks.loggerWarn).toHaveBeenCalledWith('route degraded', {
      route: '/parking',
      requestId: 'req-789',
    });
  });
});
