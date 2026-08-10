// Title: Issue Time Filters Test
// Path: src/app/admin/issues/issue-time-filters.test.ts
// Functionality: Unit coverage for Parking Issues reported/resolved date-window filtering.

import { describe, expect, it } from 'vitest';
import {
  ISSUE_TIME_FILTER_BASIS,
  ISSUE_TIME_FILTER_PRESET,
  issueMatchesTimeFilter,
  type IssueTimeFilterState,
} from './issue-time-filters';

const now = new Date(2026, 6, 7, 12, 0, 0, 0);

const baseFilter = (overrides: Partial<IssueTimeFilterState>): IssueTimeFilterState => ({
  basis: ISSUE_TIME_FILTER_BASIS.reported,
  preset: ISSUE_TIME_FILTER_PRESET.all,
  customFrom: '',
  customTo: '',
  ...overrides,
});

const issue = (createdAt: string, resolvedAt: string | null = null) => ({
  created_at: createdAt,
  resolved_at: resolvedAt,
});

describe('issue time filters', () => {
  it('allows every issue when the preset is all', () => {
    expect(issueMatchesTimeFilter(
      issue('2025-01-01T00:00:00.000Z'),
      baseFilter({ preset: ISSUE_TIME_FILTER_PRESET.all }),
      now,
    )).toBe(true);
  });

  it('matches reported issues created today', () => {
    const filter = baseFilter({ preset: ISSUE_TIME_FILTER_PRESET.today });

    expect(issueMatchesTimeFilter(issue('2026-07-07T12:00:00.000Z'), filter, now)).toBe(true);
    expect(issueMatchesTimeFilter(issue('2026-07-06T12:00:00.000Z'), filter, now)).toBe(false);
  });

  it('uses inclusive last-seven-day windows', () => {
    const filter = baseFilter({ preset: ISSUE_TIME_FILTER_PRESET.last7Days });

    expect(issueMatchesTimeFilter(issue('2026-07-01T12:00:00.000Z'), filter, now)).toBe(true);
    expect(issueMatchesTimeFilter(issue('2026-06-30T12:00:00.000Z'), filter, now)).toBe(false);
  });

  it('can filter by resolved date instead of reported date', () => {
    const filter = baseFilter({
      basis: ISSUE_TIME_FILTER_BASIS.resolved,
      preset: ISSUE_TIME_FILTER_PRESET.last30Days,
    });

    expect(issueMatchesTimeFilter(issue('2026-01-01T00:00:00.000Z', '2026-07-05T10:00:00.000Z'), filter, now)).toBe(true);
    expect(issueMatchesTimeFilter(issue('2026-07-07T10:00:00.000Z', null), filter, now)).toBe(false);
  });

  it('applies custom from/to bounds inclusively', () => {
    const filter = baseFilter({
      preset: ISSUE_TIME_FILTER_PRESET.custom,
      customFrom: '2026-07-03',
      customTo: '2026-07-05',
    });

    expect(issueMatchesTimeFilter(issue('2026-07-03T12:00:00.000Z'), filter, now)).toBe(true);
    expect(issueMatchesTimeFilter(issue('2026-07-05T12:00:00.000Z'), filter, now)).toBe(true);
    expect(issueMatchesTimeFilter(issue('2026-07-06T12:00:00.000Z'), filter, now)).toBe(false);
  });
});
