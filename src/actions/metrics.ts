// Title: Admin Alert Metrics
// Path: src/actions/metrics.ts
// Functionality: Server-side counters for global admin navigation alerts.

'use server';

import { requireAdmin } from '@/lib/auth';
import { toActionError, toDatabaseAppError } from '@/lib/errors';
import { logActionError } from '@/lib/action-logger';
import { ACCOUNT_STATUS, PARKING_ISSUE_STATUS, VEHICLE_APPROVAL_STATUS } from '@/config/domain';

export interface AdminAlertMetrics {
  users: number;
  vehicles: number;
  incidents: number;
}

interface DbError {
  code?: string;
  message?: string;
}

const isMissingRelation = (error: DbError | null | undefined) =>
  error?.code === '42P01' || (error?.message || '').toLowerCase().includes('parking_issues');

export async function loadAdminAlertMetricsAction() {
  try {
    const { supabase } = await requireAdmin();

    const [pendingAccounts, pendingVehicles, openIssues] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('approval_status', ACCOUNT_STATUS.pendingApproval),
      supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('approval_status', VEHICLE_APPROVAL_STATUS.pendingApproval),
      supabase.from('parking_issues').select('id', { count: 'exact', head: true }).in('status', [PARKING_ISSUE_STATUS.open, PARKING_ISSUE_STATUS.inProgress]),
    ]);

    if (pendingAccounts.error) {
      throw toDatabaseAppError(pendingAccounts.error, { INTERNAL_ERROR: 'Failed to load pending account count.' });
    }
    if (pendingVehicles.error) {
      throw toDatabaseAppError(pendingVehicles.error, { INTERNAL_ERROR: 'Failed to load pending vehicle count.' });
    }
    if (openIssues.error && !isMissingRelation(openIssues.error)) {
      throw toDatabaseAppError(openIssues.error, { INTERNAL_ERROR: 'Failed to load parking issue count.' });
    }

    const metrics: AdminAlertMetrics = {
      users: pendingAccounts.count || 0,
      vehicles: pendingVehicles.count || 0,
      incidents: openIssues.error ? 0 : openIssues.count || 0,
    };

    return { success: true as const, metrics };
  } catch (err) {
    await logActionError('loadAdminAlertMetricsAction failed', err);
    return toActionError(err);
  }
}
