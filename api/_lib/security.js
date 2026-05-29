import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const adminCookieName = 'pr_admin';
const bookAccessCookieName = 'pr_book_access';
const hourMs = 60 * 60 * 1000;
const passwordDisplayKeyBytes = 32;

export async function hashPassword(password) {
  const { Algorithm, hash } = await import('@node-rs/argon2');
  return hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
}

export async function verifyPassword(storedHash, password) {
  if (!storedHash || !password) return false;
  try {
    const { verify } = await import('@node-rs/argon2');
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}

export function readAdminSession(request) {
  return readSignedCookie(request, adminCookieName);
}

export function createAdminCookie(secret) {
  return createSignedCookie(adminCookieName, { role: 'admin' }, secret, 6 * hourMs);
}

export function assertAdmin(request) {
  const session = readAdminSession(request);
  return session?.role === 'admin';
}

export function readBookAccess(request) {
  const payload = readSignedCookie(request, bookAccessCookieName);
  return Array.isArray(payload?.books) ? payload.books : [];
}

export function createBookAccessCookie(request, bookId, secret) {
  const books = new Set(readBookAccess(request));
  books.add(bookId);
  return createSignedCookie(bookAccessCookieName, { books: [...books] }, secret, 30 * 24 * hourMs);
}

export function getSetupStatus() {
  return {
    hasDatabase: Boolean(process.env.DATABASE_URL),
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    hasAnalyticsHashSecret: Boolean(process.env.ANALYTICS_HASH_SECRET),
    hasAdminPasswordHash: Boolean(process.env.ADMIN_PASSWORD_HASH),
    hasBookPasswordEncryptionKey: Boolean(process.env.BOOK_PASSWORD_ENCRYPTION_KEY)
  };
}

export function encryptDisplayPassword(password, rawKey = process.env.BOOK_PASSWORD_ENCRYPTION_KEY) {
  const key = getPasswordDisplayKey(rawKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    ciphertext: ciphertext.toString('base64url')
  });
}

export function decryptDisplayPassword(payload, rawKey = process.env.BOOK_PASSWORD_ENCRYPTION_KEY) {
  if (!payload) return null;
  const key = getPasswordDisplayKey(rawKey);

  try {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (parsed?.v !== 1 || parsed?.alg !== 'aes-256-gcm') return null;

    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(parsed.tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(parsed.ciphertext, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  } catch {
    return null;
  }
}

export function createSignedCookie(name, payload, secret, maxAgeMs) {
  if (!secret) throw new Error('SESSION_SECRET is required.');
  const expiresAt = Date.now() + maxAgeMs;
  const body = Buffer.from(JSON.stringify({ ...payload, exp: expiresAt })).toString('base64url');
  const signature = sign(body, secret);
  const maxAgeSeconds = Math.max(1, Math.floor(maxAgeMs / 1000));
  return `${name}=${body}.${signature}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function readSignedCookie(request, name, secret = process.env.SESSION_SECRET) {
  if (!secret) return null;
  const cookieHeader = request.headers.cookie || '';
  const raw = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);

  if (!raw) return null;

  const [body, signature] = raw.split('.');
  if (!body || !signature || !constantTimeEqual(signature, sign(body, secret))) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function sign(body, secret) {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getPasswordDisplayKey(rawKey) {
  if (!rawKey) {
    throw new Error('BOOK_PASSWORD_ENCRYPTION_KEY is required to save display passwords.');
  }

  const normalizedKey = rawKey.trim();
  const candidates = [
    () => Buffer.from(normalizedKey, 'base64url'),
    () => Buffer.from(normalizedKey, 'base64'),
    () => Buffer.from(normalizedKey, 'hex')
  ];

  for (const decode of candidates) {
    try {
      const key = decode();
      if (key.length === passwordDisplayKeyBytes) return key;
    } catch {
      // Try the next supported encoding.
    }
  }

  throw new Error('BOOK_PASSWORD_ENCRYPTION_KEY must be 32 bytes encoded as base64url, base64, or hex.');
}
