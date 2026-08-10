// Title: Server Action Validation
// Path: src/lib/action-validation.ts
// Functionality: Shared validation helpers for server action pagination, IDs, and bulk limits.

import { AppError } from '@/lib/errors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface CursorParams {
  cursorCreatedAt?: string | null;
  cursorId?: string | null;
}

export function resolvePageLimit(value: number | null | undefined, defaultLimit: number, maxLimit: number) {
  if (value == null) return defaultLimit;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new AppError('VALIDATION_ERROR', 'Invalid page size.');
  }
  return Math.min(value, maxLimit);
}

export function validateUuid(value: string, label = 'ID') {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!UUID_PATTERN.test(trimmed)) {
    throw new AppError('VALIDATION_ERROR', `Invalid ${label}.`);
  }
  return trimmed;
}

export function validateUuidList(values: unknown, maxItems: number, label = 'record ID') {
  if (!Array.isArray(values)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid bulk selection.');
  }
  if (values.length > maxItems) {
    throw new AppError('VALIDATION_ERROR', `Bulk actions are limited to ${maxItems} records.`);
  }

  const uniqueIds = new Set<string>();
  values.forEach(value => {
    if (typeof value !== 'string') {
      throw new AppError('VALIDATION_ERROR', `Invalid ${label}.`);
    }
    uniqueIds.add(validateUuid(value, label));
  });

  return Array.from(uniqueIds);
}

export function validateBulkSize(values: unknown, maxItems: number, label = 'rows') {
  if (!Array.isArray(values)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid bulk input.');
  }
  if (values.length > maxItems) {
    throw new AppError('VALIDATION_ERROR', `Bulk actions are limited to ${maxItems} ${label}.`);
  }
}

export function resolveCursor(params: CursorParams) {
  const hasCreatedAt = Boolean(params.cursorCreatedAt);
  const hasId = Boolean(params.cursorId);
  if (!hasCreatedAt && !hasId) return null;
  if (!hasCreatedAt || !hasId) {
    throw new AppError('VALIDATION_ERROR', 'Invalid pagination cursor.');
  }

  const cursorCreatedAt = String(params.cursorCreatedAt).trim();
  if (!ISO_TIMESTAMP_PATTERN.test(cursorCreatedAt) || Number.isNaN(Date.parse(cursorCreatedAt))) {
    throw new AppError('VALIDATION_ERROR', 'Invalid pagination cursor.');
  }

  return {
    cursorCreatedAt,
    cursorId: validateUuid(String(params.cursorId), 'cursor ID'),
  };
}

export function resolveDateOnly(value: string | null | undefined, label: string) {
  if (!value) return null;
  if (typeof value !== 'string') {
    throw new AppError('VALIDATION_ERROR', `Invalid ${label}.`);
  }
  const trimmed = value.trim();
  if (!DATE_ONLY_PATTERN.test(trimmed)) {
    throw new AppError('VALIDATION_ERROR', `Invalid ${label}.`);
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new AppError('VALIDATION_ERROR', `Invalid ${label}.`);
  }

  return trimmed;
}
