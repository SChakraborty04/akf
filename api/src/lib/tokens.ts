import { sign, verify } from 'hono/jwt';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type AccessTokenPayload = {
  sub: string; // user id
  gid: string | null; // group id (null for global admin)
  role: 'super_admin' | 'admin' | 'operator' | 'viewer' | 'do' | 'shg';
  iat: number;
  exp: number;
};

export async function signAccessToken(
  secret: string,
  claims: { userId: string; groupId: string | null; role: 'super_admin' | 'admin' | 'operator' | 'viewer' | 'do' | 'shg' },
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload: AccessTokenPayload = {
    sub: claims.userId,
    gid: claims.groupId,
    role: claims.role,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  };
  return sign(payload, secret, 'HS256');
}

/** Throws if the signature is invalid or the token is expired. */
export async function verifyAccessToken(secret: string, token: string): Promise<AccessTokenPayload> {
  return (await verify(token, secret, 'HS256')) as unknown as AccessTokenPayload;
}

/** 256-bit random opaque token, base64url. */
export function generateRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
