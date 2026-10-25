import { neon, Pool } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePool } from 'drizzle-orm/neon-serverless';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

/**
 * Driver-agnostic drizzle handle. Services only depend on this type, so they
 * run unchanged on neon-http (reads), neon-serverless transactions (writes)
 * and PGlite (tests).
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Runs `fn` inside a real database transaction (commit on resolve, rollback on throw). */
export type TxRunner = <T>(fn: (tx: Db) => Promise<T>) => Promise<T>;

/** Stateless HTTP driver: one round-trip per query, ideal for read endpoints on Workers. */
export function createReadDb(databaseUrl: string): Db {
  return drizzleHttp(neon(databaseUrl), { schema }) as unknown as Db;
}

/**
 * neon-http cannot run interactive transactions, so writes use a short-lived
 * WebSocket Pool. The pool is closed after the response via `waitUntil`.
 */
export function createTxRunner(databaseUrl: string, waitUntil: (p: Promise<unknown>) => void): TxRunner {
  return async (fn) => {
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const db = drizzlePool(pool, { schema });
      return await db.transaction(async (tx) => fn(tx as unknown as Db));
    } finally {
      waitUntil(pool.end().catch(() => undefined));
    }
  };
}

export { schema };
