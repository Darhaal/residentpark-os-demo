// Title: Limits Configuration
// Path: src/config/limits.ts
// Functionality: Centralized configuration values and UI metadata for application workflows.

export const PAGE_LIMITS = {
  invitations: 50,
  users: 50,
  auditLogs: 500,
  auditLogsExport: 50000,
  globalSearchResults: 6,
  adminNotices: 300,
  noticeRecipients: 500,
  residentNotices: 100,
  notificationAccounts: 5,
  notificationVehicles: 5,
  notificationIssues: 3,
  residentNotifications: 8,
} as const;

export const BULK_ACTION_LIMITS = {
  selectedRecords: 100,
  invitationRows: 250,
} as const;

// Per-actor rate limits enforced by tx_check_rate_limit (migration 0016).
// `max` requests are allowed per trailing `windowSeconds` for each signed-in user.
export const RATE_LIMITS = {
  account_create: { max: 20, windowSeconds: 60 },
  user_bulk: { max: 30, windowSeconds: 60 },
  invite_bulk: { max: 10, windowSeconds: 60 },
  vehicle_bulk: { max: 30, windowSeconds: 60 },
  notice_send: { max: 30, windowSeconds: 60 },
  disruption_create: { max: 20, windowSeconds: 60 },
  disruption_activate: { max: 30, windowSeconds: 60 },
  disruption_complete: { max: 30, windowSeconds: 60 },
  disruption_cancel: { max: 30, windowSeconds: 60 },
  global_search: { max: 120, windowSeconds: 60 },
  audit_export: { max: 10, windowSeconds: 60 },
  vehicle_submit: { max: 10, windowSeconds: 3600 },
  issue_report: { max: 20, windowSeconds: 3600 },
} as const;

export type RateLimitKey = keyof typeof RATE_LIMITS;

export const UI_TIMING = {
  searchDebounceMs: 500,
  globalSearchDebounceMs: 250,
  searchFocusDelayMs: 50,
  minimumSearchChars: 2,
  successToastMs: 3000,
  errorToastMs: 5000,
  notificationOpenDelayMs: 120,
  notificationCloseDelayMs: 220,
} as const;

export const INVITATION_CONFIG = {
  expirationDays: 7,
} as const;

export const NOTIFICATION_CONFIG = {
  maxBadgeCount: 99,
} as const;

export const TIME_UNITS = {
  minuteMs: 60_000,
  hourMinutes: 60,
  dayHours: 24,
  weekDays: 7,
} as const;
