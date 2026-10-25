import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Error with a stable machine-readable `code` that the PWA can switch on. */
export class AppError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);
export const forbidden = (message = 'You do not have permission to do this', code = 'FORBIDDEN') =>
  new AppError(403, code, message);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (message: string, code = 'CONFLICT', details?: unknown) =>
  new AppError(409, code, message, details);
export const unprocessable = (message: string, code = 'UNPROCESSABLE', details?: unknown) =>
  new AppError(422, code, message, details);

/** Postgres unique-violation (SQLSTATE 23505), tolerant of driver wrapping. */
export function isUniqueViolation(err: unknown, constraintHint?: string): boolean {
  let e: any = err;
  for (let i = 0; e && i < 4; i++, e = e.cause) {
    if (e.code === '23505') return constraintHint ? String(e.constraint ?? e.message ?? '').includes(constraintHint) : true;
  }
  return false;
}
