import { describe, expect, test } from 'bun:test';
import { createTestApp, PASSWORD } from './helpers';

describe('Auth routes & security', () => {
  test('POST /v1/auth/login succeeds with correct credentials and returns session', async () => {
    const { login } = await createTestApp();
    const res = await login('lakshigroup', PASSWORD);
    expect(res.status).toBe(200);
    expect(res.json.success).toBe(true);
    expect(res.json.data.tokenType).toBe('Bearer');
    expect(typeof res.json.data.accessToken).toBe('string');
    expect(typeof res.json.data.refreshToken).toBe('string');
    expect(res.json.data.user.username).toBe('lakshigroup');
    expect(res.json.data.user.role).toBe('operator');
    expect(res.json.data.user.groupName).toBe('Lakshi Group');
  });

  test('POST /v1/auth/login rejects invalid password', async () => {
    const { login } = await createTestApp();
    const res = await login('lakshigroup', 'wrong-pass');
    expect(res.status).toBe(401);
    expect(res.json.success).toBe(false);
    expect(res.json.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('POST /v1/auth/login locks account after 5 consecutive failures', async () => {
    const { login } = await createTestApp();
    for (let i = 0; i < 4; i++) {
      const res = await login('lakshigroup', 'bad-pass');
      expect(res.status).toBe(401);
      expect(res.json.error.code).toBe('INVALID_CREDENTIALS');
    }

    // 5th failed attempt triggers account lock
    const res5 = await login('lakshigroup', 'bad-pass');
    expect(res5.status).toBe(429);
    expect(res5.json.error.code).toBe('ACCOUNT_LOCKED');
    expect(res5.headers.get('Retry-After')).toBeTruthy();
  });

  test('POST /v1/auth/refresh rotates the refresh token and issues new access token', async () => {
    const { login, request } = await createTestApp();
    const loginRes = await login('lakshigroup', PASSWORD);
    const originalRefreshToken = loginRes.json.data.refreshToken;

    const refreshRes = await request('/v1/auth/refresh', {
      method: 'POST',
      json: { refreshToken: originalRefreshToken },
    });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.json.success).toBe(true);
    expect(typeof refreshRes.json.data.accessToken).toBe('string');
    expect(typeof refreshRes.json.data.refreshToken).toBe('string');
    expect(refreshRes.json.data.refreshToken).not.toBe(originalRefreshToken);

    // Old token should be invalidated (token reuse check)
    const reuseRes = await request('/v1/auth/refresh', {
      method: 'POST',
      json: { refreshToken: originalRefreshToken },
    });
    expect(reuseRes.status).toBe(401);
    expect(reuseRes.json.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  test('GET /v1/auth/me returns current user profile and rejects unauthenticated requests', async () => {
    const { request, token } = await createTestApp();
    // Unauthenticated
    const unauth = await request('/v1/auth/me');
    expect(unauth.status).toBe(401);

    // Authenticated
    const t = await token();
    const authed = await request('/v1/auth/me', { token: t });
    expect(authed.status).toBe(200);
    expect(authed.json.data.username).toBe('lakshigroup');
    expect(authed.json.data.fullName).toBe('Lakshi Group Operator');
  });

  test('PATCH /v1/auth/me updates display name and language preference', async () => {
    const { request, token } = await createTestApp();
    const t = await token();

    const patchRes = await request('/v1/auth/me', {
      method: 'PATCH',
      token: t,
      json: { fullName: 'Sunita Operator', language: 'hi' },
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.json.data.fullName).toBe('Sunita Operator');
    expect(patchRes.json.data.language).toBe('hi');
  });

  test('POST /v1/auth/change-password changes password and revokes previous refresh tokens', async () => {
    const { request, login } = await createTestApp();
    const loginRes = await login('lakshigroup', PASSWORD);
    const accessToken = loginRes.json.data.accessToken;
    const refreshToken = loginRes.json.data.refreshToken;

    const changeRes = await request('/v1/auth/change-password', {
      method: 'POST',
      token: accessToken,
      json: { currentPassword: PASSWORD, newPassword: 'new-secure-password-123' },
    });
    expect(changeRes.status).toBe(200);
    expect(changeRes.json.data.passwordChanged).toBe(true);

    // Old password should now fail
    const oldLogin = await login('lakshigroup', PASSWORD);
    expect(oldLogin.status).toBe(401);

    // New password should succeed
    const newLogin = await login('lakshigroup', 'new-secure-password-123');
    expect(newLogin.status).toBe(200);

    // Old refresh token was revoked
    const refreshOld = await request('/v1/auth/refresh', {
      method: 'POST',
      json: { refreshToken },
    });
    expect(refreshOld.status).toBe(401);
  });
});
