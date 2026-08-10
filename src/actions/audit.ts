// Title: Audit Server Actions
// Path: src/actions/audit.ts
// Functionality: Server actions for querying and manually creating system events.

'use server';

import { toActionError } from '@/lib/errors';
import { requireSuperadmin } from '@/lib/auth';
import { logActionError } from '@/lib/action-logger';
import { enforceRateLimit } from '@/lib/rate-limit';
import { PAGE_LIMITS } from '@/config/limits';
import { resolveCursor, resolveDateOnly, resolvePageLimit } from '@/lib/action-validation';
import { AuditService, type AuditEventSeverity } from '@/services/AuditService';

// NOTE: a 'use server' module may only export async functions, so the AuditLog and
// JsonValue types are imported directly from AuditService by consumers (UI, utils,
// tests) rather than re-exported here.

export interface LoadAuditLogsParams {
  cursorCreatedAt?: string | null;
  cursorId?: string | null;
  limit?: number;
  search?: string | null;
  actionFilter?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}

function inclusiveDateTo(dateTo: string | null) {
  if (!dateTo) return null;
  const date = new Date(`${dateTo}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function buildAuditExportDescription(params: {
  rowCount: number;
  hasMore: boolean;
  limit: number;
  search: string | null;
  actionFilter: string;
  dateFrom: string | null;
  dateTo: string | null;
}) {
  const filters = [
    `rows=${params.rowCount}`,
    `limit=${params.limit}`,
    `truncated=${params.hasMore ? 'yes' : 'no'}`,
    `action=${params.actionFilter || 'ALL'}`,
    `from=${params.dateFrom || 'any'}`,
    `to=${params.dateTo || 'any'}`,
    `search=${params.search ? 'present' : 'none'}`,
  ];
  return `Audit log export prepared (${filters.join(', ')}).`;
}

export async function createManualEventAction(data: {
  domain: string;
  actionType: string;
  severity: AuditEventSeverity;
  description: string;
}) {
  try {
    const { supabase } = await requireSuperadmin();
    await AuditService.createManualEvent(supabase, data);

    return { success: true as const };
  } catch (err) {
    await logActionError('createManualEventAction failed', err);
    return toActionError(err);
  }
}

export async function loadAuditLogsAction(params: LoadAuditLogsParams = {}) {
  try {
    const { supabase, userId, email, role } = await requireSuperadmin();
    const limit = resolvePageLimit(params.limit, PAGE_LIMITS.auditLogs, PAGE_LIMITS.auditLogsExport);
    if (limit > PAGE_LIMITS.auditLogs) {
      await enforceRateLimit(supabase, 'audit_export');
    }
    const cursor = resolveCursor(params);
    const dateFrom = resolveDateOnly(params.dateFrom, 'from date');
    const dateTo = resolveDateOnly(params.dateTo, 'to date');

    const [{ data: profile }, rows] = await Promise.all([
      supabase.from('profiles').select('full_name, role').eq('id', userId).single(),
      AuditService.loadLogs(supabase, {
        cursorCreatedAt: cursor?.cursorCreatedAt ?? null,
        cursorId: cursor?.cursorId ?? null,
        limitCount: limit + 1,
        searchQuery: params.search?.trim() || null,
        actionFilter: params.actionFilter || 'ALL',
        dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).toISOString() : null,
        dateTo: inclusiveDateTo(dateTo),
      }),
    ]);

    const visibleRows = rows.slice(0, limit);
    const hasMore = rows.length > limit;

    if (limit > PAGE_LIMITS.auditLogs) {
      await AuditService.createManualEvent(
        supabase,
        {
          domain: 'system',
          actionType: 'AUDIT_LOG_EXPORT',
          severity: 'warning',
          description: buildAuditExportDescription({
            rowCount: visibleRows.length,
            hasMore,
            limit,
            search: params.search?.trim() || null,
            actionFilter: params.actionFilter || 'ALL',
            dateFrom,
            dateTo,
          }),
        },
        'Failed to record audit export event.',
      );
    }

    return {
      success: true as const,
      currentUser: {
        full_name: profile?.full_name ?? email,
        role: profile?.role ?? role,
      },
      logs: visibleRows,
      hasMore,
    };
  } catch (err) {
    await logActionError('loadAuditLogsAction failed', err);
    return toActionError(err);
  }
}
