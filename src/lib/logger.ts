import 'server-only';

/**
 * Structured logging with request correlation.
 *
 * Everything is emitted as one JSON line so a log aggregator can parse it.
 * Values are redacted by key before they are written: the point is that adding
 * a whole object to a log entry can never accidentally publish a secret, so
 * callers do not have to remember which fields are sensitive.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Substrings that mark a value as never loggable. Matched case-insensitively. */
const REDACTED_KEY_PATTERNS = [
  'password',
  'passwordhash',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'accesskey',
  'databaseurl',
  'database_url',
  'connectionstring',
  'card',
  'cvc',
  'cvv',
  'pan',
  'iban',
  'sourcekey',
  'securitykey',
];

const REDACTED = '[redacted]';
const MAX_DEPTH = 6;

function shouldRedact(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, '');
  return REDACTED_KEY_PATTERNS.some((pattern) => normalized.includes(pattern.replace(/[-_]/g, '')));
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_DEPTH) return '[truncated]';

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      // Stacks stay server-side; they are never sent to a client response.
      stack: value.stack,
    };
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = shouldRedact(key) ? REDACTED : sanitize(nested, depth + 1);
    }
    return output;
  }

  if (typeof value === 'string' && value.length > 2_000) {
    return `${value.slice(0, 2_000)}…[truncated]`;
  }
  return value;
}

export type LogContext = Record<string, unknown> & { requestId?: string };

function write(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? (sanitize(context) as Record<string, unknown>) : {}),
  };

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV !== 'production') write('debug', message, context);
  },
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
};

/** Correlation id for one request, so related log lines can be grouped. */
export function newRequestId(): string {
  return crypto.randomUUID();
}

/** Exposed for the logger's own tests. */
export const __testing = { sanitize, shouldRedact };
