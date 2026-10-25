import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { ok, validate } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { getGroupProfile, getShapes } from '../services/group.service';
import { getMemberDetail, listMembers } from '../services/members.service';

export const groupRoutes = new Hono<AppEnv>();
groupRoutes.use('*', requireAuth);

/** GET /v1/group - SHG profile, current cycle, stamp value, rates (Profile screen header). */
groupRoutes.get('/', async (c) => ok(c, await getGroupProfile(c.var.db, c.var.auth.groupId!, c.var.today)));

/** GET /v1/group/shapes - loan shapes with loan value and repayment (2%) value. */
groupRoutes.get('/shapes', async (c) => ok(c, await getShapes(c.var.db, c.var.auth.groupId!)));

export const memberRoutes = new Hono<AppEnv>();
memberRoutes.use('*', requireAuth);

/** GET /v1/members - active members ordered by household number (dropdowns, directory). */
memberRoutes.get('/', async (c) => {
  const items = await listMembers(c.var.db, c.var.auth.groupId!);
  return ok(c, items, { meta: { total: items.length } });
});

/** GET /v1/members/:id - full profile (incl. ID no.) + savings / loans / repaid overview. */
memberRoutes.get('/:id', validate('param', z.object({ id: z.uuid() })), async (c) =>
  ok(c, await getMemberDetail(c.var.db, c.var.auth.groupId!, c.req.valid('param').id)),
);
