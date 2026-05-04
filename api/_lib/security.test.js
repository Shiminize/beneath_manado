import { afterEach, describe, expect, it } from 'vitest';
import { resolvePasswordDisplayState } from './database.js';
import {
  createSignedCookie,
  decryptDisplayPassword,
  encryptDisplayPassword,
  hashPassword,
  readSignedCookie,
  verifyPassword
} from './security.js';

describe('security helpers', () => {
  const previousBookPasswordEncryptionKey = process.env.BOOK_PASSWORD_ENCRYPTION_KEY;
  const displayKey = Buffer.alloc(32, 7).toString('base64url');

  afterEach(() => {
    if (previousBookPasswordEncryptionKey === undefined) {
      delete process.env.BOOK_PASSWORD_ENCRYPTION_KEY;
      return;
    }

    process.env.BOOK_PASSWORD_ENCRYPTION_KEY = previousBookPasswordEncryptionKey;
  });

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

  it('encrypts and decrypts admin-display book passwords', () => {
    process.env.BOOK_PASSWORD_ENCRYPTION_KEY = displayKey;
    const payload = encryptDisplayPassword('VisibleBook44.');

    expect(payload).not.toContain('VisibleBook44.');
    expect(decryptDisplayPassword(payload)).toBe('VisibleBook44.');
  });

  it('requires a valid display-password encryption key before saving display passwords', () => {
    delete process.env.BOOK_PASSWORD_ENCRYPTION_KEY;
    expect(() => encryptDisplayPassword('VisibleBook44.')).toThrow('BOOK_PASSWORD_ENCRYPTION_KEY');

    process.env.BOOK_PASSWORD_ENCRYPTION_KEY = 'not-a-32-byte-key';
    expect(() => encryptDisplayPassword('VisibleBook44.')).toThrow('32 bytes');
  });

  it('reports visible, none, and reset-required password display states', () => {
    process.env.BOOK_PASSWORD_ENCRYPTION_KEY = displayKey;
    const encryptedPayload = encryptDisplayPassword('VisibleBook44.');

    expect(resolvePasswordDisplayState({ password_hash: null })).toEqual({
      passwordDisplay: null,
      passwordState: 'none'
    });
    expect(resolvePasswordDisplayState({ password_hash: '$argon2id$hash', password_display_payload: null })).toEqual({
      passwordDisplay: null,
      passwordState: 'reset_required'
    });
    expect(resolvePasswordDisplayState({ password_hash: '$argon2id$hash', password_display_payload: encryptedPayload })).toEqual({
      passwordDisplay: 'VisibleBook44.',
      passwordState: 'visible'
    });
  });
});
