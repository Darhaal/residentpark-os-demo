// Title: Server Action Logger
// Path: src/lib/action-logger.ts
// Functionality: Adds request correlation metadata to Server Action logs.

import {
  getRequestLogContext,
  logRequestError,
  logRequestWarn,
  type LogContext,
} from '@/lib/request-logger';

export { getRequestLogContext };

export async function logActionError(message: string, error: unknown, context?: LogContext): Promise<void> {
  await logRequestError(message, error, context);
}

export async function logActionWarn(message: string, context?: LogContext): Promise<void> {
  await logRequestWarn(message, context);
}
