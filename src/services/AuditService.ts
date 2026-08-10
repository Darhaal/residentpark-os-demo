// Title: Audit Domain Service
// Path: src/services/AuditService.ts
// Functionality: Typed adapter around audit-log RPCs with runtime return-shape validation and safe error mapping.

import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, toDatabaseAppError } from '@/lib/errors';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type AuditEventSeverity = 'info' | 'warning' | 'critical';

export interface AuditLog {
  id: string;
  admin_id: string | null;
  action_type: string;
  description: string;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
  old_data: Record<string, JsonValue> | null;
  new_data: Record<string, JsonValue> | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  actor_email_snapshot: string | null;
  actor_role_snapshot: string | null;
  admin_full_name: string | null;
  admin_email: string | null;
}

interface CreateManualEventParams {
  domain: string;
  actionType: string;
  severity: AuditEventSeverity;
  description: string;
}

interface LoadAuditLogsRpcParams {
  cursorCreatedAt: string | null;
  cursorId: string | null;
  limitCount: number;
  searchQuery: string | null;
  actionFilter: string;
  dateFrom: string | null;
  dateTo: string | null;
}

const severityValues: AuditEventSeverity[] = ['info', 'warning', 'critical'];

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nullableString = (value: unknown) => value == null || typeof value === 'string';

const jsonRecordOrNull = (value: unknown): Record<string, JsonValue> | null => {
  if (value == null) return null;
  if (!isPlainRecord(value)) throw new AppError('INTERNAL_ERROR', 'Audit log payload shape is invalid.');
  return value as Record<string, JsonValue>;
};

function parseAuditLogRow(row: unknown): AuditLog {
  if (!isPlainRecord(row)) throw new AppError('INTERNAL_ERROR', 'Audit log row shape is invalid.');
  if (typeof row.id !== 'string' || typeof row.action_type !== 'string' || typeof row.description !== 'string' || typeof row.created_at !== 'string') {
    throw new AppError('INTERNAL_ERROR', 'Audit log row is missing required fields.');
  }
  if (
    !nullableString(row.admin_id) ||
    !nullableString(row.entity_type) ||
    !nullableString(row.entity_id) ||
    !nullableString(row.ip_address) ||
    !nullableString(row.user_agent) ||
    !nullableString(row.request_id) ||
    !nullableString(row.actor_email_snapshot) ||
    !nullableString(row.actor_role_snapshot) ||
    !nullableString(row.admin_full_name) ||
    !nullableString(row.admin_email)
  ) {
    throw new AppError('INTERNAL_ERROR', 'Audit log row contains invalid nullable fields.');
  }

  return {
    id: row.id,
    admin_id: row.admin_id ?? null,
    action_type: row.action_type,
    description: row.description,
    created_at: row.created_at,
    entity_type: row.entity_type ?? null,
    entity_id: row.entity_id ?? null,
    old_data: jsonRecordOrNull(row.old_data),
    new_data: jsonRecordOrNull(row.new_data),
    ip_address: row.ip_address ?? null,
    user_agent: row.user_agent ?? null,
    request_id: row.request_id ?? null,
    actor_email_snapshot: row.actor_email_snapshot ?? null,
    actor_role_snapshot: row.actor_role_snapshot ?? null,
    admin_full_name: row.admin_full_name ?? null,
    admin_email: row.admin_email ?? null,
  };
}

export class AuditService {
  static async createManualEvent(
    supabase: SupabaseClient,
    params: CreateManualEventParams,
    fallbackMessage = 'Failed to create audit event.',
  ): Promise<void> {
    const domain = params.domain.trim();
    const actionType = params.actionType.trim().toUpperCase();
    const description = params.description.trim();

    if (!domain) throw new AppError('VALIDATION_ERROR', 'Audit event domain is required.');
    if (!actionType) throw new AppError('VALIDATION_ERROR', 'Audit event action type is required.');
    if (!severityValues.includes(params.severity)) throw new AppError('VALIDATION_ERROR', 'Invalid audit event severity.');
    if (!description) throw new AppError('VALIDATION_ERROR', 'Audit event description is required.');

    const { error } = await supabase.rpc('tx_create_manual_event', {
      p_domain: domain,
      p_action_type: actionType,
      p_severity: params.severity,
      p_description: description,
    });

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: fallbackMessage });
  }

  static async loadLogs(supabase: SupabaseClient, params: LoadAuditLogsRpcParams): Promise<AuditLog[]> {
    const { data, error } = await supabase.rpc('get_audit_logs', {
      cursor_created_at: params.cursorCreatedAt,
      cursor_id: params.cursorId,
      limit_count: params.limitCount,
      search_query: params.searchQuery,
      action_filter: params.actionFilter,
      date_from: params.dateFrom,
      date_to: params.dateTo,
    });

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Failed to load audit logs.' });
    if (!Array.isArray(data)) throw new AppError('INTERNAL_ERROR', 'Audit log RPC returned an invalid shape.');
    return data.map(parseAuditLogRow);
  }
}
