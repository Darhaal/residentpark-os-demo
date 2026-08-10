// Title: Structured Error Handling
// Path: src/lib/errors.ts
// Functionality: Unified error definitions, database error translation, and safe client-facing action errors.

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RULE_VIOLATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  static isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
  }
}

export type ActionError = { success: false; error: string; code: ErrorCode };

type DbErrorLike = {
  code?: string | null;
  message?: string | null;
  status?: number | null;
};

const DEFAULT_DB_ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: 'Authentication required.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested record was not found.',
  VALIDATION_ERROR: 'Some of the submitted information is invalid.',
  RULE_VIOLATION: 'This action is not allowed in the current state.',
  CONFLICT: 'A conflicting record already exists.',
  RATE_LIMITED: 'You are doing that too often. Please wait a moment and try again.',
  INTERNAL_ERROR: 'The database request failed. Please try again.',
};

function isDbErrorLike(error: unknown): error is DbErrorLike {
  if (!error || typeof error !== 'object') return false;
  return 'code' in error || 'message' in error || 'status' in error;
}

function codeFromRpcMessage(message: string): ErrorCode | null {
  const normalized = message.toUpperCase();
  if (normalized.includes('RATE_LIMITED')) return 'RATE_LIMITED';
  if (normalized.includes('UNAUTHORIZED')) return 'UNAUTHORIZED';
  if (normalized.includes('FORBIDDEN')) return 'FORBIDDEN';
  if (normalized.includes('NOT_FOUND')) return 'NOT_FOUND';
  if (normalized.includes('VALIDATION')) return 'VALIDATION_ERROR';
  if (normalized.includes('RULE')) return 'RULE_VIOLATION';
  return null;
}

function codeFromDbError(error: DbErrorLike): ErrorCode {
  const code = error.code || '';
  const message = error.message || '';

  if (code === '23505') return 'CONFLICT';
  if (code === '23503' || code === '23514') return 'RULE_VIOLATION';
  if (code === '22023' || code === '22P02') return 'VALIDATION_ERROR';
  if (code === '42501') return 'FORBIDDEN';
  if (code === 'PGRST116' || code === 'P0002') return 'NOT_FOUND';
  if (code === 'P0001') return codeFromRpcMessage(message) ?? 'RULE_VIOLATION';
  if (code === 'PGRST202' || code === '42883') return 'INTERNAL_ERROR';

  if (error.status === 401) return 'UNAUTHORIZED';
  if (error.status === 403) return 'FORBIDDEN';
  if (error.status === 404) return 'NOT_FOUND';
  if (error.status === 409) return 'CONFLICT';
  if (error.status === 400 || error.status === 422) return 'VALIDATION_ERROR';

  return codeFromRpcMessage(message) ?? 'INTERNAL_ERROR';
}

export function toDatabaseAppError(
  error: unknown,
  messages: Partial<Record<ErrorCode, string>> = {},
): AppError {
  if (AppError.isAppError(error)) return error;

  if (!isDbErrorLike(error)) {
    return new AppError('INTERNAL_ERROR', messages.INTERNAL_ERROR ?? DEFAULT_DB_ERROR_MESSAGES.INTERNAL_ERROR, error);
  }

  const code = codeFromDbError(error);
  return new AppError(code, messages[code] ?? DEFAULT_DB_ERROR_MESSAGES[code], error);
}

export function toActionError(error: unknown): ActionError {
  if (AppError.isAppError(error)) {
    return { success: false, error: error.message, code: error.code };
  }
  return {
    success: false,
    error: 'An unexpected error occurred. Please try again.',
    code: 'INTERNAL_ERROR',
  };
}
