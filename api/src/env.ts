import type { Db, TxRunner } from './db/client';

/** Worker bindings / secrets (see wrangler.jsonc `vars` and `.dev.vars`). */
export type Bindings = {
  DATABASE_URL: string;
  /** HS256 signing secret for access tokens (>= 32 chars). `wrangler secret put JWT_SECRET` in prod. */
  JWT_SECRET: string;
  /** Comma separated list of allowed browser origins. */
  CORS_ORIGINS?: string;
  /** IANA timezone used to decide "today" for interest accrual. Default Asia/Kolkata. */
  TIMEZONE?: string;
};

export type AuthContext = {
  userId: string;
  groupId: string | null;
  role: 'super_admin' | 'admin' | 'operator' | 'viewer' | 'do' | 'shg';
  username: string;
  fullName: string;
  language: 'en' | 'hi';
  assignedGroupIds?: string[] | null;
};

export type Variables = {
  db: Db;
  tx: TxRunner;
  auth: AuthContext;
  today: string;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
