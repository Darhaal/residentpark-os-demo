// Title: Server Action Validation Test
// Path: src/lib/action-validation.test.ts
// Functionality: Unit coverage for server action limit, cursor, and ID validation.

import { describe, expect, it } from 'vitest';
import { AppError } from './errors';
import {
  resolveCursor,
  resolveDateOnly,
  resolvePageLimit,
  validateBulkSize,
  validateUuid,
  validateUuidList,
} from './action-validation';

const uuidA = '11111111-1111-1111-1111-111111111111';
const uuidB = '22222222-2222-2222-2222-222222222222';

const expectValidationError = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('VALIDATION_ERROR');
    return;
  }
  throw new Error('Expected validation error');
};

describe('resolvePageLimit', () => {
  it('uses defaults and caps oversized requests', () => {
    expect(resolvePageLimit(undefined, 50, 100)).toBe(50);
    expect(resolvePageLimit(1000, 50, 100)).toBe(100);
  });

  it('rejects invalid page sizes', () => {
    expectValidationError(() => resolvePageLimit(0, 50, 100));
    expectValidationError(() => resolvePageLimit(1.5, 50, 100));
  });
});

describe('validateUuid', () => {
  it('returns trimmed UUID values', () => {
    expect(validateUuid(` ${uuidA} `)).toBe(uuidA);
  });

  it('rejects malformed UUID values', () => {
    expectValidationError(() => validateUuid('not-a-uuid'));
  });
});

describe('validateUuidList', () => {
  it('deduplicates valid UUID values', () => {
    expect(validateUuidList([uuidA, uuidA, uuidB], 10)).toEqual([uuidA, uuidB]);
  });

  it('rejects oversized and malformed bulk selections', () => {
    expectValidationError(() => validateUuidList([uuidA, uuidB], 1));
    expectValidationError(() => validateUuidList([uuidA, 'bad'], 10));
  });
});

describe('validateBulkSize', () => {
  it('allows arrays within the limit', () => {
    expect(validateBulkSize([1, 2], 2)).toBeUndefined();
  });

  it('rejects non-arrays and oversized arrays', () => {
    expectValidationError(() => validateBulkSize('bad', 2));
    expectValidationError(() => validateBulkSize([1, 2, 3], 2));
  });
});

describe('resolveCursor', () => {
  it('returns null when no cursor is provided', () => {
    expect(resolveCursor({})).toBeNull();
  });

  it('validates complete cursor pairs', () => {
    expect(resolveCursor({
      cursorCreatedAt: '2026-06-19T04:00:00.123Z',
      cursorId: uuidA,
    })).toEqual({
      cursorCreatedAt: '2026-06-19T04:00:00.123Z',
      cursorId: uuidA,
    });
  });

  it('rejects partial and malformed cursors', () => {
    expectValidationError(() => resolveCursor({ cursorCreatedAt: '2026-06-19T04:00:00.123Z' }));
    expectValidationError(() => resolveCursor({ cursorCreatedAt: 'bad-date', cursorId: uuidA }));
    expectValidationError(() => resolveCursor({ cursorCreatedAt: '2026-06-19T04:00:00.123Z', cursorId: 'bad' }));
  });
});

describe('resolveDateOnly', () => {
  it('accepts valid date-only strings', () => {
    expect(resolveDateOnly('2026-06-19', 'date')).toBe('2026-06-19');
  });

  it('rejects impossible or non-date-only strings', () => {
    expectValidationError(() => resolveDateOnly('2026-02-31', 'date'));
    expectValidationError(() => resolveDateOnly('2026-06-19T00:00:00Z', 'date'));
    expectValidationError(() => resolveDateOnly(123 as unknown as string, 'date'));
  });
});
