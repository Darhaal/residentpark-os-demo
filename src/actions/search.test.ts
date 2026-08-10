// Title: Global Search Action Test
// Path: src/actions/search.test.ts
// Functionality: Unit coverage for global search rate-limit wiring and short-circuit behavior.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { PAGE_LIMITS } from '@/config/limits';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  logActionError: vi.fn(),
  requireAdmin: vi.fn(),
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

import { globalSearchAction } from './search';

function makeQuery(result = { data: [], error: null }) {
  const query = {
    select: vi.fn(() => query),
    or: vi.fn(() => query),
    neq: vi.fn(() => query),
    ilike: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  return query;
}

function setupAdmin() {
  const queries = [makeQuery(), makeQuery(), makeQuery(), makeQuery()];
  const issuedQueries = [...queries];
  const from = vi.fn(() => {
    const query = queries.shift();
    if (!query) throw new Error('Unexpected search query');
    return query;
  });
  const supabase = { from };
  mocks.requireAdmin.mockResolvedValue({ supabase });
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.logActionError.mockResolvedValue(undefined);
  return { from, queries: issuedQueries, supabase };
}

describe('globalSearchAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces the global-search rate limit before querying search tables', async () => {
    const { from, supabase } = setupAdmin();

    await expect(globalSearchAction('ABC')).resolves.toEqual({
      success: true,
      results: { vehicles: [], residents: [], apartments: [], spots: [] },
    });

    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(supabase, 'global_search');
    expect(from).toHaveBeenCalledTimes(4);
    expect(mocks.enforceRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      from.mock.invocationCallOrder[0],
    );
  });

  it('does not query search tables when the global-search rate limit is hit', async () => {
    const { from } = setupAdmin();
    mocks.enforceRateLimit.mockRejectedValue(new AppError('RATE_LIMITED', 'Please wait before searching again.'));

    await expect(globalSearchAction('ABC')).resolves.toEqual({
      success: false,
      error: 'Please wait before searching again.',
      code: 'RATE_LIMITED',
    });

    expect(from).not.toHaveBeenCalled();
  });

  it('does not rate-limit or query for too-short searches', async () => {
    const { from } = setupAdmin();

    await expect(globalSearchAction('A')).resolves.toEqual({
      success: true,
      results: { vehicles: [], residents: [], apartments: [], spots: [] },
    });

    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('sanitizes PostgREST search syntax and applies per-table result limits', async () => {
    const { queries } = setupAdmin();

    await expect(globalSearchAction('A,B*(C)%\\D')).resolves.toMatchObject({ success: true });

    for (const query of queries) {
      expect(query.limit).toHaveBeenCalledWith(PAGE_LIMITS.globalSearchResults);
    }
    expect(queries[0].or).toHaveBeenCalledWith(expect.not.stringContaining(',B*(C)%\\D'));
    expect(queries[1].or).toHaveBeenCalledWith(expect.not.stringContaining(',B*(C)%\\D'));
    expect(queries[2].ilike).toHaveBeenCalledWith('apartment_number', expect.not.stringContaining(',B*(C)%\\D'));
    expect(queries[3].ilike).toHaveBeenCalledWith('spot_number', expect.not.stringContaining(',B*(C)%\\D'));
  });
});
