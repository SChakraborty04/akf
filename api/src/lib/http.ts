import { zValidator } from '@hono/zod-validator';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ZodType } from 'zod';
import { AppError } from './errors';

/** zod-validated request part; failures become a uniform 422 VALIDATION_ERROR. */
export const validate = <T extends ZodType>(target: 'json' | 'query' | 'param', schema: T) =>
  zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new AppError(
        422,
        'VALIDATION_ERROR',
        'Request validation failed',
        result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }
  });

/** Standard success envelope: `{ success: true, data, ...extra }`. */
export function ok<T>(c: Context, data: T, extra: Record<string, unknown> = {}, status: ContentfulStatusCode = 200) {
  return c.json({ success: true as const, data, ...extra }, status);
}

export function created<T>(c: Context, data: T, extra: Record<string, unknown> = {}) {
  return ok(c, data, extra, 201);
}
