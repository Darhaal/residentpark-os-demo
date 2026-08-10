// Title: Disruptions Types
// Path: src/app/admin/disruptions/disruptions-types.test.ts
// Functionality: Shared TypeScript types for construction disruption screens, actions, and component contracts.

import { describe, expect, it } from 'vitest';
import { getMetaNumber, isDisruptionStatus } from './disruptions-types';

describe('getMetaNumber', () => {
  it('reads numeric values from a meta object', () => {
    expect(getMetaNumber({ blocked: 5 }, 'blocked')).toBe(5);
  });

  it('returns 0 for missing keys or non-numbers', () => {
    expect(getMetaNumber({ blocked: 5 }, 'relocated')).toBe(0);
    expect(getMetaNumber({ blocked: 'x' }, 'blocked')).toBe(0);
    expect(getMetaNumber(null, 'blocked')).toBe(0);
    expect(getMetaNumber(undefined, 'blocked')).toBe(0);
  });
});

describe('isDisruptionStatus', () => {
  it('rejects unknown status strings', () => {
    expect(isDisruptionStatus('definitely-not-a-status')).toBe(false);
    expect(isDisruptionStatus('')).toBe(false);
  });
});
