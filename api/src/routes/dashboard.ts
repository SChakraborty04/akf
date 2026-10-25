import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { listLedger } from '../services/ledger.service';
import { getDashboardSummary, getSnapshot } from '../services/summary.service';

export const dashboardRoutes = new Hono<AppEnv>();
dashboardRoutes.use('*', requireAuth);

/** GET /v1/dashboard - 4-quadrant summary + the 5 most recent ledger entries. */
dashboardRoutes.get('/', async (c) => {
  const groupId = c.var.auth.groupId!;
  const [summary, recent] = await Promise.all([
    getDashboardSummary(c.var.db, groupId, c.var.today),
    listLedger(c.var.db, groupId, {}, { page: 1, limit: 5 }),
  ]);
  return ok(c, { summary, recentLedger: recent.items });
});

export const snapshotRoutes = new Hono<AppEnv>();
snapshotRoutes.use('*', requireAuth);

/** GET /v1/snapshot - full offline-store payload (same keys as the PWA's local DataContext). */
snapshotRoutes.get('/', async (c) => ok(c, await getSnapshot(c.var.db, c.var.auth.groupId!, c.var.today)));
