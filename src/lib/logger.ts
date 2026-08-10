// Title: Logger
// Path: src/lib/logger.ts
// Functionality: Structured JSON logging over the console, with integration points for
// Sentry/Logtail/Datadog. Context is typed as `unknown` so callers can't pass untyped
// data through the logging boundary.

type LogContext = Record<string, unknown>;

// Static fields attached to every line so logs are attributable once shipped to an
// aggregator (service name + environment). Kept minimal and PII-free by default.
const BASE = {
  service: 'resident-park-os',
  env: process.env.NODE_ENV ?? 'development',
} as const;

export const logger = {
  info: (message: string, context?: LogContext) => {
    console.info(JSON.stringify({ level: 'INFO', ...BASE, message, timestamp: new Date().toISOString(), ...context }));
  },

  warn: (message: string, context?: LogContext) => {
    // Integration point: Logtail.warn(message, context)
    console.warn(JSON.stringify({ level: 'WARN', ...BASE, message, timestamp: new Date().toISOString(), ...context }));
  },

  error: (message: string, error?: unknown, context?: LogContext) => {
    // Integration point: Sentry.captureException(error, { extra: context })
    const err = error as { message?: string; stack?: string } | undefined;
    console.error(JSON.stringify({
      level: 'ERROR',
      ...BASE,
      message,
      error: err?.message ?? error,
      stack: err?.stack,
      timestamp: new Date().toISOString(),
      ...context
    }));
  },

  audit: (action: string, context?: LogContext) => {
    // Integration point: Forward to dedicated SIEM (Security Information and Event Management)
    console.info(JSON.stringify({ level: 'SECURITY_AUDIT', ...BASE, action, timestamp: new Date().toISOString(), ...context }));
  }
};
