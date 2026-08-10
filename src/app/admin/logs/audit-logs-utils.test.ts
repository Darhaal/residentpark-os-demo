// Title: Audit Logs Utils Test
// Path: src/app/admin/logs/audit-logs-utils.test.ts
// Functionality: Unit coverage for audit log helpers and type-level behavior.

import { describe, expect, it } from 'vitest';
import { buildLogQuery, escapeCSV, getDeepDiff } from './audit-logs-utils';

describe('escapeCSV', () => {
  it('quotes values and doubles inner quotes', () => {
    expect(escapeCSV('a,b')).toBe('"a,b"');
    expect(escapeCSV('he said "hi"')).toBe('"he said ""hi"""');
  });

  it('neutralizes formula-injection prefixes', () => {
    expect(escapeCSV('=1+1')).toBe('"\'=1+1"');
    expect(escapeCSV('@cmd')).toBe('"\'@cmd"');
  });

  it('renders null/undefined as an empty quoted cell', () => {
    expect(escapeCSV(null)).toBe('""');
    expect(escapeCSV(undefined)).toBe('""');
  });
});

describe('buildLogQuery', () => {
  it('trims search and omits the ALL action filter', () => {
    expect(buildLogQuery({ search: '  hi ', action: 'ALL', from: '', to: '' })).toBe('search=hi');
  });

  it('includes action and date bounds', () => {
    expect(buildLogQuery({ search: '', action: 'USER_INVITED', from: '2024-01-01', to: '2024-02-01' }))
      .toBe('action=USER_INVITED&from=2024-01-01&to=2024-02-01');
  });

  it('returns an empty string with no filters', () => {
    expect(buildLogQuery({ search: '', action: 'ALL', from: '', to: '' })).toBe('');
  });
});

describe('getDeepDiff', () => {
  it('returns no diff for equal objects', () => {
    expect(getDeepDiff({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it('reports changed scalar fields', () => {
    expect(getDeepDiff({ name: 'a' }, { name: 'b' })).toEqual([
      { field: 'name', oldValue: '"a"', newValue: '"b"' },
    ]);
  });

  it('walks nested objects with dotted paths', () => {
    expect(getDeepDiff({ x: { y: 1 } }, { x: { y: 2 } })).toEqual([
      { field: 'x.y', oldValue: '1', newValue: '2' },
    ]);
  });

  it('marks added keys with an undefined old value', () => {
    expect(getDeepDiff({}, { a: 1 })).toEqual([
      { field: 'a', oldValue: 'undefined', newValue: '1' },
    ]);
  });
});
