import { z } from 'zod';
import { isValidYmd } from './interest';

export const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine(isValidYmd, 'Invalid calendar date');

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;

export function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export const offsetOf = (p: { page: number; limit: number }) => (p.page - 1) * p.limit;

/** Optional date range + member filters shared by every list screen in the PWA. */
export const rangeQuerySchema = z.object({
  from: ymdSchema.optional(),
  to: ymdSchema.optional(),
  memberId: z.uuid().optional(),
});
