// Title: Audit Logs Utils
// Path: src/app/admin/logs/audit-logs-utils.ts
// Functionality: Route-level component for audit log workflows and UI composition.

// Pure helpers, types, and constants for the audit logs client. No React state —
// safe to unit test and reuse across the client and its extracted modals.

import type { JsonValue } from '@/services/AuditService';

export type Severity = 'info' | 'warning' | 'critical';

export interface ManualLogDraft {
  domain: string;
  actionType: string;
  severity: Severity;
  description: string;
}

export interface DiffRecord {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface LogFilters {
  search: string;
  action: string;
  from: string;
  to: string;
}

export const ACTION_TYPES = [
  'UPDATE_PERMISSIONS',
  'USER_INVITED',
  'VEHICLE_REMOVED',
  'APARTMENT_LINKED',
  'SYSTEM_SETTINGS_CHANGED',
  'ACCOUNT_STATUS_CHANGED',
  'AUDIT_LOG_EXPORTED',
];

export const escapeCSV = (value: unknown) => {
  if (value == null) return '""';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
};

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  return fallback;
};

const isRecord = (value: JsonValue | undefined): value is Record<string, JsonValue> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringifyDiffValue = (value: JsonValue | undefined) =>
  value !== undefined ? JSON.stringify(value) : 'undefined';

export function getDeepDiff(
  oldData: Record<string, JsonValue> | null,
  newData: Record<string, JsonValue> | null,
  prefix = ''
): DiffRecord[] {
  const oldObj = oldData || {};
  const newObj = newData || {};
  const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
  const diffs: DiffRecord[] = [];

  for (const key of keys) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const oldValue = oldObj[key];
    const newValue = newObj[key];

    if (isRecord(oldValue) && isRecord(newValue)) {
      diffs.push(...getDeepDiff(oldValue, newValue, fullPath));
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      diffs.push({
        field: fullPath,
        oldValue: stringifyDiffValue(oldValue),
        newValue: stringifyDiffValue(newValue),
      });
    }
  }

  return diffs;
}

export const buildLogQuery = (filters: LogFilters) => {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.action && filters.action !== 'ALL') params.set('action', filters.action);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return params.toString();
};
