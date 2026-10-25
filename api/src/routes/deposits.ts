import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { ok, validate } from '../lib/http';
import { withClientIdRetry } from '../lib/idempotency';
import { pageQuerySchema, rangeQuerySchema, ymdSchema } from '../lib/pagination';
import { requireAuth, requireOperator } from '../middleware/auth';
import { createDeposit, findDepositByClientId, getDeposit, listDeposits } from '../services/deposits.service';

const depositBody = z.object({
  date: ymdSchema.optional(),
  note: z.string().trim().max(200).optional(),
  clientId: z.uuid().optional(),
  items: z
    .array(z.object({ memberId: z.uuid(), stamps: z.number().int().min(0).max(100) }))
    .min(1)
    .max(500),
});

export const depositRoutes = new Hono<AppEnv>();
depositRoutes.use('*', requireAuth);

/** GET /v1/deposits?from&to&memberId&page&limit - meeting deposits with member breakdown + total. */
depositRoutes.get('/', validate('query', rangeQuerySchema.extend(pageQuerySchema.shape)), async (c) => {
  const { page, limit, ...filters } = c.req.valid('query');
  const result = await listDeposits(c.var.db, c.var.auth.groupId!, filters, { page, limit });
  return ok(c, result.items, { summary: result.summary, meta: result.meta });
});

/** GET /v1/deposits/:id */
depositRoutes.get('/:id', validate('param', z.object({ id: z.uuid() })), async (c) =>
  ok(c, await getDeposit(c.var.db, c.var.auth.groupId!, c.req.valid('param').id)),
);

/**
 * POST /v1/deposits - record a meeting's savings.
 * Body: { date?, note?, clientId?, items: [{ memberId, stamps }] }  (amounts are computed server-side)
 * 201 when created, 200 + `idempotentReplay: true` when `clientId` was already recorded.
 */
depositRoutes.post('/', requireOperator, validate('json', depositBody), async (c) => {
  const body = c.req.valid('json');
  const groupId = c.var.auth.groupId!;
  const userId = c.var.auth.userId;
  const ctx = { groupId, userId, today: c.var.today };
  const result = await withClientIdRetry(
    body.clientId,
    () => c.var.tx((tx) => createDeposit(tx, ctx, body)),
    async () => {
      const deposit = await findDepositByClientId(c.var.db, groupId, body.clientId!);
      return deposit ? { deposit, created: false } : null;
    },
  );
  return ok(c, result.deposit, { idempotentReplay: !result.created }, result.created ? 201 : 200);
});
