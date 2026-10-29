import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';
import { forbidden, unauthorized } from '../lib/errors';
import { verifyAccessToken } from '../lib/tokens';
import { findActiveUser } from '../services/auth.service';

/**
 * Verifies the Bearer access token, then re-checks the account in the DB so a
 * disabled user / group loses access immediately (not only when the token expires).
 * Error codes the PWA can act on: TOKEN_EXPIRED -> call /auth/refresh,
 * INVALID_TOKEN / UNAUTHORIZED -> go to login, ACCOUNT_DISABLED -> show message.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) throw unauthorized();

  let payload;
  try {
    const secret = c.env.JWT_SECRET || 'lakshi-shg-super-secure-dev-jwt-secret-key-32chars';
    payload = await verifyAccessToken(secret, token);
  } catch (err) {
    const expired = err instanceof Error && err.name === 'JwtTokenExpired';
    throw unauthorized(expired ? 'Access token expired' : 'Invalid access token', expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN');
  }

  const user = await findActiveUser(c.var.db, payload.sub);
  if (!user || (user.groupId && user.groupId !== payload.gid)) {
    throw unauthorized('Account is disabled or no longer exists', 'ACCOUNT_DISABLED');
  }

  c.set('auth', {
    userId: user.id,
    groupId: user.groupId,
    role: user.role,
    username: user.username,
    fullName: user.fullName,
    language: user.language,
  });
  await next();
});

/** Blocks viewers from recording deposits / loans / repayments. */
export const requireOperator = createMiddleware<AppEnv>(async (c, next) => {
  if (
    c.var.auth.role !== 'operator' &&
    c.var.auth.role !== 'shg' &&
    c.var.auth.role !== 'do' &&
    c.var.auth.role !== 'admin' &&
    c.var.auth.role !== 'super_admin'
  ) {
    throw forbidden('This account is read-only', 'READ_ONLY_ACCOUNT');
  }
  await next();
});

/** Requires admin or super_admin role for administrative actions. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.var.auth.role !== 'admin' && c.var.auth.role !== 'super_admin') {
    throw forbidden('Admin privileges required', 'ADMIN_PRIVILEGES_REQUIRED');
  }
  await next();
});
