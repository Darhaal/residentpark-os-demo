// Title: Status UI Configuration
// Path: src/config/status-ui.ts
// Functionality: Centralized configuration values and UI metadata for application workflows.

import { ACCOUNT_STATUS, VEHICLE_APPROVAL_STATUS } from '@/config/domain';

export type BadgeTone = 'success' | 'warning' | 'destructive' | 'secondary';

export function approvalStatusBadgeVariant(status: string): BadgeTone {
  if (status === ACCOUNT_STATUS.approved || status === VEHICLE_APPROVAL_STATUS.approved) return 'success';
  if (status === ACCOUNT_STATUS.pendingApproval || status === VEHICLE_APPROVAL_STATUS.pendingApproval) return 'warning';
  if (
    status === ACCOUNT_STATUS.suspended ||
    status === ACCOUNT_STATUS.rejected ||
    status === VEHICLE_APPROVAL_STATUS.rejected
  ) {
    return 'destructive';
  }
  return 'secondary';
}
