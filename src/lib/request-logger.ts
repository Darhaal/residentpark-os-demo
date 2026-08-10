// Title: Request Logger
// Path: src/lib/request-logger.ts
// Functionality: Adds request correlation metadata to server-side logs.

import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

export type LogContext = Record<string, unknown>;

export async function getRequestLogContext(context: LogContext = {}): Promise<LogContext> {
  try {
    const requestHeaders = await headers();
    const requestId = requestHeaders.get('x-request-id');
    return requestId ? { ...context, requestId } : context;
  } catch {
    return context;
  }
}

export async function logRequestError(message: string, error: unknown, context?: LogContext): Promise<void> {
  logger.error(message, error, await getRequestLogContext(context));
}

export async function logRequestWarn(message: string, context?: LogContext): Promise<void> {
  logger.warn(message, await getRequestLogContext(context));
}
