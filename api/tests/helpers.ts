import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { createApp } from '../src/app';
import type { Db } from '../src/db/client';
import { schema } from '../src/db/client';
import { seedBaseData } from '../src/db/seed';

export const ENV = { DATABASE_URL: 'unused-in-tests', JWT_SECRET: 'test-secret-test-secret-test-secret-123' };
export const PASSWORD = 'correct-horse-battery';

/** Fresh in-process Postgres with the real migrations applied. */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  return db as unknown as Db & { transaction: Db['transaction'] };
}

export async function createTestApp() {
  const db = await createTestDb();
  const app = createApp({ db, tx: (fn) => db.transaction((tx) => fn(tx as unknown as Db)) });
  const base = await seedBaseData(db, { password: PASSWORD });

  async function request(path: string, init: RequestInit & { token?: string; json?: unknown } = {}) {
    const headers = new Headers(init.headers);
    if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
    let body = init.body;
    if (init.json !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(init.json);
    }
    const res = await app.request(path, { ...init, headers, body }, ENV);
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, json, headers: res.headers };
  }

  async function login(username = 'lakshigroup', password = PASSWORD) {
    const res = await request('/v1/auth/login', { method: 'POST', json: { username, password } });
    return res;
  }

  async function token() {
    const res = await login();
    if (res.status !== 200) throw new Error(`login failed: ${JSON.stringify(res.json)}`);
    return res.json.data.accessToken as string;
  }

  return { app, db, base, request, login, token };
}
