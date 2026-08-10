// Title: Rate Limit Localization
// Path: src/localization/en/rate-limits.ts
// Functionality: User-facing retry messages for scoped rate-limited workflows.

import type { RateLimitKey } from '@/config/limits';

export const rateLimitMessages = {
  account_create: 'Please wait before creating another account.',
  user_bulk: 'Please wait before running another bulk user update.',
  invite_bulk: 'Please wait before importing more invitations.',
  vehicle_bulk: 'Please wait before another vehicle bulk review.',
  notice_send: 'Please wait before sending another notice.',
  disruption_create: 'Please wait before creating another disruption.',
  disruption_activate: 'Please wait before activating another disruption.',
  disruption_complete: 'Please wait before completing another disruption.',
  disruption_cancel: 'Please wait before cancelling another disruption.',
  global_search: 'Please wait before searching again.',
  audit_export: 'Please wait before exporting audit logs again.',
  vehicle_submit: 'Please wait before submitting another vehicle.',
  issue_report: 'Please wait before reporting another issue.',
} satisfies Record<RateLimitKey, string>;
