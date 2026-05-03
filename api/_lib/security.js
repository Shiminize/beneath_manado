import { createHmac, timingSafeEqual } from 'node:crypto';

const adminCookieName = 'pr_admin';
const bookAccessCookieName = 'pr_book_access';
const hourMs = 60 * 60 * 1000;

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
    hasAdminPasswordHash: Boolean(process.env.ADMIN_PASSWORD_HASH)
  };
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
