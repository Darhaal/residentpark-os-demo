// Title: Date Utilities
// Path: src/lib/dates.ts
// Functionality: Shared date formatting and parsing helpers for operational timelines.

// Deterministic date formatting for client components.
//
// `toLocaleDateString()` / `toLocaleString()` inherit the runtime's locale + timezone,
// which differ between the server render and the browser hydration — producing React
// hydration mismatches. Formatting with a fixed locale + UTC timezone makes server and
// client output identical, so dates are safe to render during SSR.

const DATE_FMT = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
const DATE_TIME_FMT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
});
const SHORT_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** e.g. "Jun 18, 2026" — fixed locale + UTC, hydration-safe. */
export function formatDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? DATE_FMT.format(d) : '—';
}

/** e.g. "Jun 18, 2026, 08:53 PM" — fixed locale + UTC, hydration-safe. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? DATE_TIME_FMT.format(d) : '—';
}

/** e.g. "Jun 18" — fixed locale + UTC, hydration-safe. */
export function formatShortDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? SHORT_FMT.format(d) : '—';
}
