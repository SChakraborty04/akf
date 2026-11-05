import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { createReadDb, createTxRunner, type Db, type TxRunner } from './db/client';
import type { AppEnv } from './env';
import { todayInTimezone } from './lib/dates';
import { AppError } from './lib/errors';
import { adminRoutes } from './admin/routes';
import { authRoutes } from './routes/auth';
import { dashboardRoutes, snapshotRoutes } from './routes/dashboard';
import { depositRoutes } from './routes/deposits';
import { groupRoutes, memberRoutes } from './routes/group';
import { ledgerRoutes } from './routes/ledger';
import { loanRoutes } from './routes/loans';
import { repaymentRoutes } from './routes/repayments';

/** Dev origins of Vite PWA and MIS apps. */
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
];

export type AppDeps = {
  /** Override DB wiring (used by the test-suite with an in-process Postgres). */
  db?: Db;
  tx?: TxRunner;
};

function matchOriginPattern(pattern: string, origin: string): boolean {
  if (pattern === '*' || pattern === origin) return true;
  if (pattern.includes('*')) {
    const escaped = pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`^${escaped.join('.*')}$`);
    return regex.test(origin);
  }
  return false;
}

export function createApp(deps: AppDeps = {}) {
  const app = new Hono<AppEnv>();

  app.use(
    '*',
    secureHeaders({
      crossOriginResourcePolicy: 'cross-origin',
    }),
  );
  app.use('*', async (c, next) => {
    const rawOrigins = c.env.CORS_ORIGINS?.trim();
    const customOrigins = rawOrigins ? rawOrigins.split(',').map((o) => o.trim()).filter(Boolean) : [];
    const allowed = customOrigins.length > 0 ? customOrigins : DEFAULT_ORIGINS;

    return cors({
      origin: (origin) => {
        // Native mobile clients, curl, or WebView file:// sends no origin or 'null'
        if (!origin || origin === 'null') return '*';

        // Check if explicitly allowed or wildcard is configured
        if (allowed.includes('*') || allowed.some((pattern) => matchOriginPattern(pattern, origin))) {
          return origin;
        }

        // Support all mobile APK origins (Capacitor, Cordova, Ionic, Android TWA, WebView)
        if (
          origin.startsWith('http://localhost') ||
          origin.startsWith('https://localhost') ||
          origin.startsWith('http://127.0.0.1') ||
          origin.startsWith('capacitor://') ||
          origin.startsWith('ionic://') ||
          origin.startsWith('android-app://') ||
          origin.startsWith('file://') ||
          origin.includes('androidplatform.net')
        ) {
          return origin;
        }

        // Allow any other valid origin so mobile WebView packaging never gets blocked by CORS
        return origin;
      },
      allowHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'Accept'],
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      maxAge: 86400,
    })(c, next);
  });

  // Per-request wiring: cheap (no connection is opened until a query runs).
  app.use('*', async (c, next) => {
    c.set('db', deps.db ?? createReadDb(c.env.DATABASE_URL));
    c.set(
      'tx',
      deps.tx ??
        createTxRunner(c.env.DATABASE_URL, (p) => {
          try {
            c.executionCtx.waitUntil(p);
          } catch {
            /* no ExecutionContext (tests) */
          }
        }),
    );
    c.set('today', todayInTimezone(c.env.TIMEZONE));
    await next();
  });

  app.get('/', (c) => c.json({ success: true, service: 'shg-plus-api', version: 'v1' }));
  app.get('/health', (c) => c.json({ success: true, status: 'ok', time: new Date().toISOString() }));

  const v1 = new Hono<AppEnv>();
  v1.route('/auth', authRoutes);
  v1.route('/group', groupRoutes);
  v1.route('/members', memberRoutes);
  v1.route('/dashboard', dashboardRoutes);
  v1.route('/snapshot', snapshotRoutes);
  v1.route('/deposits', depositRoutes);
  v1.route('/loans', loanRoutes);
  v1.route('/repayments', repaymentRoutes);
  v1.route('/ledger', ledgerRoutes);
  app.route('/v1', v1);
  app.route('/admin', adminRoutes);

  app.notFound((c) =>
    c.json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` } }, 404),
  );

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ success: false, error: { code: err.code, message: err.message, details: err.details } }, err.status);
    }
    if (err instanceof HTTPException) {
      return c.json({ success: false, error: { code: 'HTTP_ERROR', message: err.message } }, err.status);
    }
    // Never leak driver / SQL errors to clients.
    console.error('Unhandled error', err);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, 500);
  });

  return app;
}
