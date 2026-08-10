// Title: Issue Time Filters
// Path: src/app/admin/issues/issue-time-filters.ts
// Functionality: Pure date-window helpers for Parking Issues reported/resolved time filters.

export const ISSUE_TIME_FILTER_BASIS = {
  reported: 'reported',
  resolved: 'resolved',
} as const;

export const ISSUE_TIME_FILTER_PRESET = {
  all: 'all',
  today: 'today',
  last7Days: 'last_7_days',
  last30Days: 'last_30_days',
  custom: 'custom',
} as const;

export type IssueTimeFilterBasis = (typeof ISSUE_TIME_FILTER_BASIS)[keyof typeof ISSUE_TIME_FILTER_BASIS];
export type IssueTimeFilterPreset = (typeof ISSUE_TIME_FILTER_PRESET)[keyof typeof ISSUE_TIME_FILTER_PRESET];

export interface IssueTimeFilterState {
  basis: IssueTimeFilterBasis;
  preset: IssueTimeFilterPreset;
  customFrom: string;
  customTo: string;
}

interface IssueTimeFilterRow {
  created_at: string;
  resolved_at: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const endOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const parseDateInput = (value: string, boundary: 'start' | 'end') => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return boundary === 'start' ? startOfDay(date) : endOfDay(date);
};

export function getIssueTimeFilterRange(filter: IssueTimeFilterState, now = new Date()) {
  if (filter.preset === ISSUE_TIME_FILTER_PRESET.all) return { from: null, to: null };

  if (filter.preset === ISSUE_TIME_FILTER_PRESET.custom) {
    return {
      from: parseDateInput(filter.customFrom, 'start'),
      to: parseDateInput(filter.customTo, 'end'),
    };
  }

  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  if (filter.preset === ISSUE_TIME_FILTER_PRESET.today) {
    return { from: todayStart, to: todayEnd };
  }

  const days = filter.preset === ISSUE_TIME_FILTER_PRESET.last7Days ? 7 : 30;
  return {
    from: new Date(todayStart.getTime() - (days - 1) * DAY_MS),
    to: todayEnd,
  };
}

export function issueMatchesTimeFilter(issue: IssueTimeFilterRow, filter: IssueTimeFilterState, now = new Date()) {
  const { from, to } = getIssueTimeFilterRange(filter, now);
  if (!from && !to) return true;

  const value = filter.basis === ISSUE_TIME_FILTER_BASIS.reported ? issue.created_at : issue.resolved_at;
  if (!value) return false;

  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  if (from && time < from.getTime()) return false;
  if (to && time > to.getTime()) return false;
  return true;
}
