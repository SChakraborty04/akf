import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { ok, validate } from '../lib/http';
import { withClientIdRetry } from '../lib/idempotency';
import { pageQuerySchema, rangeQuerySchema, ymdSchema } from '../lib/pagination';
import { requireAuth, requireOperator } from '../middleware/auth';
import {
  createRepayment,
  findRepaymentByClientId,
  getRepayment,
  listRepayments,
  previewRepayment,
} from '../services/repayments.service';

const stampRef = z.object({ shape: z.string().trim().min(1).max(40) });

const repaymentBody = z.object({
  loanId: z.uuid(),
  memberId: z.uuid().optional(),
  date: ymdSchema.optional(),
  clientId: z.uuid().optional(),
  /** Shape codes, one per stamp; each is worth shape value x group repayment rate (2%). */
  stamps: z.array(stampRef).min(1).max(100),
});

// Preview is allowed with no stamps yet (to show unpaid interest / remaining principal).
const previewBody = repaymentBody.extend({ stamps: z.array(stampRef).max(100).optional() });

export const repaymentRoutes = new Hono<AppEnv>();
repaymentRoutes.use('*', requireAuth);

/** GET /v1/repayments?from&to&memberId&loanId&page&limit */
repaymentRoutes.get(
  '/',
  validate('query', rangeQuerySchema.extend({ loanId: z.uuid().optional() }).extend(pageQuerySchema.shape)),
  async (c) => {
    const { page, limit, ...filters } = c.req.valid('query');
    const result = await listRepayments(c.var.db, c.var.auth.groupId!, filters, { page, limit });
    return ok(c, result.items, { summary: result.summary, meta: result.meta });
  },
);

/**
 * POST /v1/repayments/preview - no writes. Returns unpaid interest, remaining
 * principal and the interest/principal split for the given stamps and date.
 */
repaymentRoutes.post('/preview', validate('json', previewBody), async (c) => {
  const body = c.req.valid('json');
  const groupId = c.var.auth.groupId!;
  const userId = c.var.auth.userId;
  return ok(c, await previewRepayment(c.var.db, { groupId, userId, today: c.var.today }, { ...body, stamps: body.stamps ?? [] }));
});

/** GET /v1/repayments/:id */
repaymentRoutes.get('/:id', validate('param', z.object({ id: z.uuid() })), async (c) =>
  ok(c, await getRepayment(c.var.db, c.var.auth.groupId!, c.req.valid('param').id)),
);

/**
 * POST /v1/repayments - record a repayment (interest first, then principal).
 * Body: { loanId, memberId?, date?, clientId?, stamps: [{ shape }] }
 * Rejects overpayment (422 OVERPAYMENT) and paid loans (422 LOAN_ALREADY_PAID).
 */
repaymentRoutes.post('/', requireOperator, validate('json', repaymentBody), async (c) => {
  const body = c.req.valid('json');
  const groupId = c.var.auth.groupId!;
  const userId = c.var.auth.userId;
  const ctx = { groupId, userId, today: c.var.today };
  const result = await withClientIdRetry(
    body.clientId,
    () => c.var.tx((tx) => createRepayment(tx, ctx, body)),
    async () => {
      const repayment = await findRepaymentByClientId(c.var.db, groupId, body.clientId!);
      return repayment ? { repayment, created: false } : null;
    },
  );
  return ok(c, result.repayment, { idempotentReplay: !result.created }, result.created ? 201 : 200);
});
