import { describe, expect, it } from 'vitest';
import { createSignedCookie, hashPassword, readSignedCookie, verifyPassword } from './security.js';

describe('security helpers', () => {
  it('hashes and verifies passwords with Argon2id', async () => {
    const storedHash = await hashPassword('correct-password');
    expect(storedHash).toContain('argon2id');
    expect(await verifyPassword(storedHash, 'correct-password')).toBe(true);
    expect(await verifyPassword(storedHash, 'wrong-password')).toBe(false);
  });

  it('rejects tampered signed cookies', () => {
    const cookie = createSignedCookie('pr_admin', { role: 'admin' }, 'session-secret', 1000);
    const validRequest = { headers: { cookie } };
    expect(readSignedCookie(validRequest, 'pr_admin', 'session-secret')?.role).toBe('admin');

    const tamperedRequest = { headers: { cookie: cookie.replace('pr_admin=', 'pr_admin=x') } };
    expect(readSignedCookie(tamperedRequest, 'pr_admin', 'session-secret')).toBeNull();
  });
});
