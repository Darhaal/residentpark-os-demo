// Title: Apartments Types
// Path: src/app/admin/apartments/apartments-types.test.ts
// Functionality: Shared TypeScript types for apartment and occupancy screens, actions, and component contracts.

import { describe, expect, it } from 'vitest';
import { APARTMENT_STATUS } from '@/config/domain';
import { aptStatusVariant, approvalVariant, getCount } from './apartments-types';

describe('getCount', () => {
  it('reads the first aggregate count', () => {
    expect(getCount([{ count: 3 }])).toBe(3);
  });

  it('defaults to 0 for empty/null input', () => {
    expect(getCount([])).toBe(0);
    expect(getCount(null)).toBe(0);
    expect(getCount(undefined)).toBe(0);
    expect(getCount([{ count: null }])).toBe(0);
  });
});

describe('aptStatusVariant', () => {
  it('maps apartment statuses to badge tones', () => {
    expect(aptStatusVariant(APARTMENT_STATUS.occupied)).toBe('success');
    expect(aptStatusVariant(APARTMENT_STATUS.restricted)).toBe('warning');
    expect(aptStatusVariant(APARTMENT_STATUS.problem)).toBe('destructive');
    expect(aptStatusVariant(APARTMENT_STATUS.vacant)).toBe('secondary');
  });
});

describe('approvalVariant', () => {
  it('falls back to secondary for missing status', () => {
    expect(approvalVariant(null)).toBe('secondary');
    expect(approvalVariant(undefined)).toBe('secondary');
  });
});
