import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { ok, validate } from '../lib/http';
import { withClientIdRetry } from '../lib/idempotency';
import { pageQuerySchema, rangeQuerySchema, ymdSchema } from '../lib/pagination';
import { requireAuth, requireOperator } from '../middleware/auth';
import { createLoan, findLoanByClientId, getLoan, listLoans } from '../services/loans.service';

const loanBody = z.object({
  memberId: z.uuid(),
  date: ymdSchema.optional(),
  clientId: z.uuid().optional(),
  /** Shape codes from GET /v1/group/shapes, one entry per physical stamp. Values come from the server. */
  stamps: z.array(z.object({ shape: z.string().trim().min(1).max(40) })).min(1).max(100),
});

export const loanRoutes = new Hono<AppEnv>();
loanRoutes.use('*', requireAuth);

/** GET /v1/loans?from&to&memberId&status&page&limit - loans with live interest figures. */
loanRoutes.get(
  '/',
  validate('query', rangeQuerySchema.extend({ status: z.enum(['active', 'paid']).optional() }).extend(pageQuerySchema.shape)),
  async (c) => {
    const { page, limit, ...filters } = c.req.valid('query');
    const result = await listLoans(c.var.db, c.var.auth.groupId!, filters, c.var.today, { page, limit });
    return ok(c, result.items, { summary: result.summary, meta: result.meta });
  },
);

/** GET /v1/loans/:id?asOf=YYYY-MM-DD - loan + month-by-month interest table + its repayments. */
loanRoutes.get(
  '/:id',
  validate('param', z.object({ id: z.uuid() })),
  validate('query', z.object({ asOf: ymdSchema.optional() })),
  async (c) =>
    ok(c, await getLoan(c.var.db, c.var.auth.groupId!, c.req.valid('param').id, c.var.today, c.req.valid('query').asOf)),
);

/**
 * POST /v1/loans - disburse a loan.
 * Body: { memberId, date?, clientId?, stamps: [{ shape }] }  (principal = sum of shape values)
 */
loanRoutes.post('/', requireOperator, validate('json', loanBody), async (c) => {
  const body = c.req.valid('json');
  const groupId = c.var.auth.groupId!;
  const userId = c.var.auth.userId;
  const ctx = { groupId, userId, today: c.var.today };
  const result = await withClientIdRetry(
    body.clientId,
    () => c.var.tx((tx) => createLoan(tx, ctx, body)),
    async () => {
      const loan = await findLoanByClientId(c.var.db, groupId, body.clientId!, c.var.today);
      return loan ? { loan, created: false } : null;
    },
  );
  return ok(c, result.loan, { idempotentReplay: !result.created }, result.created ? 201 : 200);
});
