import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { groups, refreshTokens, users } from '../db/schema';
import { getDummyHash, hashPassword, verifyPassword } from '../lib/password';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  sha256Hex,
  signAccessToken,
} from '../lib/tokens';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

type UserRow = typeof users.$inferSelect;

export type PublicUser = {
  id: string;
  username: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'operator' | 'viewer';
  language: 'en' | 'hi';
  groupId: string | null;
  groupName: string | null;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: PublicUser;
};

export type AuthFailure = 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_DISABLED' | 'INVALID_REFRESH_TOKEN';

/**
 * Failures are returned (not thrown) so the surrounding transaction still
 * COMMITS the bookkeeping side effects (failed-login counters, token-reuse
 * revocation). The route turns them into HTTP errors afterwards.
 */
export type SessionResult =
  | { ok: true; session: Session }
  | { ok: false; reason: AuthFailure; retryAfterSeconds?: number };

export const normalizeUsername = (u: string) => u.trim().toLowerCase();

async function loadUser(db: Db, where: ReturnType<typeof eq>) {
  const rows = await db
    .select({ user: users, groupName: groups.name, groupActive: groups.isActive })
    .from(users)
    .leftJoin(groups, eq(groups.id, users.groupId))
    .where(where)
    .limit(1);
  return rows[0];
}

export const toPublicUser = (user: UserRow, groupName: string | null): PublicUser => ({
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  role: user.role,
  language: user.language,
  groupId: user.groupId,
  groupName,
});

async function issueSession(
  db: Db,
  secret: string,
  user: UserRow,
  groupName: string | null,
  userAgent: string | null,
): Promise<Session> {
  const refreshToken = generateRefreshToken();
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: await sha256Hex(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    userAgent: userAgent?.slice(0, 300) ?? null,
  });
  const accessToken = await signAccessToken(secret, {
    userId: user.id,
    groupId: user.groupId,
    role: user.role,
  });
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: toPublicUser(user, groupName),
  };
}

/** Run inside a transaction. */
export async function login(
  tx: Db,
  secret: string,
  input: { username: string; password: string },
  userAgent: string | null,
): Promise<SessionResult> {
  const found = await loadUser(tx, eq(users.username, normalizeUsername(input.username)));

  if (!found) {
    // Burn the same CPU as a real check so response time does not reveal valid usernames.
    await verifyPassword(input.password, await getDummyHash());
    return { ok: false, reason: 'INVALID_CREDENTIALS' };
  }

  const { user, groupName, groupActive } = found;
  const now = new Date();

  if (user.lockedUntil && user.lockedUntil > now) {
    return {
      ok: false,
      reason: 'ACCOUNT_LOCKED',
      retryAfterSeconds: Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000),
    };
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash);
  if (!passwordOk) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await tx
      .update(users)
      .set({
        failedLoginCount: lock ? 0 : failed,
        lockedUntil: lock ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) : user.lockedUntil,
      })
      .where(eq(users.id, user.id));
    return lock
      ? { ok: false, reason: 'ACCOUNT_LOCKED', retryAfterSeconds: LOCKOUT_MINUTES * 60 }
      : { ok: false, reason: 'INVALID_CREDENTIALS' };
  }

  if (!user.isActive) return { ok: false, reason: 'ACCOUNT_DISABLED' };
  if (user.groupId && groupActive === false) return { ok: false, reason: 'ACCOUNT_DISABLED' };

  await tx.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: now }).where(eq(users.id, user.id));
  return { ok: true, session: await issueSession(tx, secret, user, groupName, userAgent) };
}

/** Rotating refresh. Presenting an already-used token revokes every session of that user. Run in a transaction. */
export async function refresh(
  tx: Db,
  secret: string,
  refreshToken: string,
  userAgent: string | null,
): Promise<SessionResult> {
  const hash = await sha256Hex(refreshToken);
  const [row] = await tx.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, hash)).limit(1);
  if (!row) return { ok: false, reason: 'INVALID_REFRESH_TOKEN' };

  if (row.revokedAt) {
    // Token reuse => assume theft, kill all sessions.
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, row.userId), isNull(refreshTokens.revokedAt)));
    return { ok: false, reason: 'INVALID_REFRESH_TOKEN' };
  }
  if (row.expiresAt <= new Date()) return { ok: false, reason: 'INVALID_REFRESH_TOKEN' };

  const found = await loadUser(tx, eq(users.id, row.userId));
  if (!found || !found.user.isActive) return { ok: false, reason: 'ACCOUNT_DISABLED' };
  if (found.user.groupId && found.groupActive === false) return { ok: false, reason: 'ACCOUNT_DISABLED' };

  await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, row.id));
  return { ok: true, session: await issueSession(tx, secret, found.user, found.groupName, userAgent) };
}

export async function logout(db: Db, refreshToken: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, await sha256Hex(refreshToken)), isNull(refreshTokens.revokedAt)));
}

export async function logoutEverywhere(db: Db, userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

/** Used by the auth middleware on every request, so deactivated accounts lose access immediately. */
export async function findActiveUser(db: Db, userId: string) {
  const found = await loadUser(db, eq(users.id, userId));
  if (!found || !found.user.isActive) return null;
  if (found.user.groupId && found.groupActive === false) return null;
  return toPublicUser(found.user, found.groupName);
}

export async function getUserWithGroup(db: Db, userId: string) {
  return loadUser(db, eq(users.id, userId));
}

export async function updateProfile(
  db: Db,
  userId: string,
  patch: { fullName?: string; language?: 'en' | 'hi' },
): Promise<PublicUser | null> {
  if (Object.keys(patch).length > 0) {
    await db.update(users).set(patch).where(eq(users.id, userId));
  }
  return findActiveUser(db, userId);
}

export type ChangePasswordResult = { ok: true } | { ok: false; reason: 'WRONG_PASSWORD' | 'USER_NOT_FOUND' };

/** Run in a transaction: changes the hash and revokes every refresh token. */
export async function changePassword(
  tx: Db,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { ok: false, reason: 'USER_NOT_FOUND' };
  if (!(await verifyPassword(currentPassword, user.passwordHash))) return { ok: false, reason: 'WRONG_PASSWORD' };

  await tx
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() })
    .where(eq(users.id, userId));
  await tx
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  return { ok: true };
}
