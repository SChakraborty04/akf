import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { ok, validate } from '../lib/http';
import { pageQuerySchema, rangeQuerySchema } from '../lib/pagination';
import { requireAuth } from '../middleware/auth';
import { listLedger } from '../services/ledger.service';

const ledgerQuery = rangeQuerySchema
  .extend({ type: z.enum(['deposit', 'loan', 'repayment']).optional() })
  .extend(pageQuerySchema.shape);

export const ledgerRoutes = new Hono<AppEnv>();
ledgerRoutes.use('*', requireAuth);

/** GET /v1/ledger?from&to&memberId&type&page&limit - credit/debit feed with filtered totals. */
ledgerRoutes.get('/', validate('query', ledgerQuery), async (c) => {
  const { page, limit, ...filters } = c.req.valid('query');
  const result = await listLedger(c.var.db, c.var.auth.groupId!, filters, { page, limit });
  return ok(c, result.items, { totals: result.totals, meta: result.meta });
});
