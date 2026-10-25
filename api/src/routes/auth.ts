import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { AppError, unauthorized } from '../lib/errors';
import { ok, validate } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import * as auth from '../services/auth.service';

const credentials = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

const refreshBody = z.object({ refreshToken: z.string().min(20).max(200) });

const profilePatch = z
  .object({
    fullName: z.string().trim().min(1).max(100).optional(),
    language: z.enum(['en', 'hi']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

const changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8, 'Use at least 8 characters').max(128),
});

const FAILURE_RESPONSES: Record<auth.AuthFailure, { status: 401 | 403 | 429; message: string }> = {
  INVALID_CREDENTIALS: { status: 401, message: 'Invalid username or password' },
  ACCOUNT_LOCKED: { status: 429, message: 'Too many failed attempts. Try again later' },
  ACCOUNT_DISABLED: { status: 403, message: 'This account has been disabled' },
  INVALID_REFRESH_TOKEN: { status: 401, message: 'Refresh token is invalid or expired. Please sign in again' },
};

function failure(result: Extract<auth.SessionResult, { ok: false }>) {
  const { status, message } = FAILURE_RESPONSES[result.reason];
  return new AppError(status, result.reason, message, result.retryAfterSeconds ? { retryAfterSeconds: result.retryAfterSeconds } : undefined);
}

export const authRoutes = new Hono<AppEnv>();

/** POST /v1/auth/login - exchange username/password for an access + refresh token. */
authRoutes.post('/login', validate('json', credentials), async (c) => {
  const body = c.req.valid('json');
  const secret = c.env.JWT_SECRET || 'lakshi-shg-super-secure-dev-jwt-secret-key-32chars';
  const result = await c.var.tx((tx) => auth.login(tx, secret, body, c.req.header('User-Agent') ?? null));
  if (!result.ok) {
    if (result.retryAfterSeconds) c.header('Retry-After', String(result.retryAfterSeconds));
    throw failure(result);
  }
  return ok(c, result.session);
});

/** POST /v1/auth/refresh - rotate the refresh token and get a new access token. */
authRoutes.post('/refresh', validate('json', refreshBody), async (c) => {
  const { refreshToken } = c.req.valid('json');
  const secret = c.env.JWT_SECRET || 'lakshi-shg-super-secure-dev-jwt-secret-key-32chars';
  const result = await c.var.tx((tx) => auth.refresh(tx, secret, refreshToken, c.req.header('User-Agent') ?? null));
  if (!result.ok) throw failure(result);
  return ok(c, result.session);
});

/** POST /v1/auth/logout - revoke this device's refresh token (idempotent). */
authRoutes.post('/logout', validate('json', refreshBody), async (c) => {
  await auth.logout(c.var.db, c.req.valid('json').refreshToken);
  return ok(c, { loggedOut: true });
});

/** POST /v1/auth/logout-all - revoke every session of the current user. */
authRoutes.post('/logout-all', requireAuth, async (c) => {
  await auth.logoutEverywhere(c.var.db, c.var.auth.userId);
  return ok(c, { loggedOut: true });
});

/** GET /v1/auth/me */
authRoutes.get('/me', requireAuth, async (c) => {
  const user = await auth.findActiveUser(c.var.db, c.var.auth.userId);
  if (!user) throw unauthorized('Account is disabled or no longer exists', 'ACCOUNT_DISABLED');
  return ok(c, user);
});

/** PATCH /v1/auth/me - update display name / UI language (en | hi). */
authRoutes.patch('/me', requireAuth, validate('json', profilePatch), async (c) => {
  const user = await auth.updateProfile(c.var.db, c.var.auth.userId, c.req.valid('json'));
  if (!user) throw unauthorized('Account is disabled or no longer exists', 'ACCOUNT_DISABLED');
  return ok(c, user);
});

/** POST /v1/auth/change-password - also signs out all other sessions. */
authRoutes.post('/change-password', requireAuth, validate('json', changePasswordBody), async (c) => {
  const { currentPassword, newPassword } = c.req.valid('json');
  const result = await c.var.tx((tx) => auth.changePassword(tx, c.var.auth.userId, currentPassword, newPassword));
  if (!result.ok) {
    throw new AppError(
      result.reason === 'WRONG_PASSWORD' ? 400 : 404,
      result.reason,
      result.reason === 'WRONG_PASSWORD' ? 'Current password is incorrect' : 'User not found',
    );
  }
  return ok(c, { passwordChanged: true });
});
