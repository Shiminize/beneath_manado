import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export function getClientIp(request) {
  const forwardedFor = firstHeaderValue(request.headers['x-forwarded-for']);
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return firstHeaderValue(request.headers['x-real-ip']) || request.socket?.remoteAddress || '0.0.0.0';
}

export function getCountry(request) {
  return firstHeaderValue(request.headers['x-vercel-ip-country']) || 'unknown';
}

export function maskIpNetwork(ip) {
  const normalized = normalizeIp(ip);
  if (isIP(normalized) === 4) {
    const parts = normalized.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }

  if (isIP(normalized) === 6) {
    const parts = expandIpv6(normalized);
    if (!parts) return 'unknown';
    return `${parts.slice(0, 3).join(':')}::`;
  }

  return 'unknown';
}

export function createDailyVisitorHash({ ip, userAgent, date = new Date(), secret }) {
  if (!secret) return null;
  const day = date.toISOString().slice(0, 10);
  return createHmac('sha256', secret).update(`${day}:${normalizeIp(ip)}:${userAgent || ''}`).digest('base64url');
}

export function createRequestIdentity(request, secret) {
  const ip = getClientIp(request);
  const userAgent = firstHeaderValue(request.headers['user-agent']) || '';
  return {
    country: getCountry(request),
    ipNetwork: maskIpNetwork(ip),
    userAgent,
    visitorHash: createDailyVisitorHash({ ip, userAgent, secret })
  };
}

function normalizeIp(ip) {
  return String(ip || '')
    .split('%')[0]
    .replace(/^::ffff:/, '')
    .toLowerCase()
    .trim();
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function expandIpv6(ip) {
  const sections = ip.split('::');
  if (sections.length > 2) return null;

  const left = sections[0] ? sections[0].split(':').filter(Boolean) : [];
  const right = sections[1] ? sections[1].split(':').filter(Boolean) : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;

  return [...left, ...Array.from({ length: missing }, () => '0'), ...right].map((part) =>
    (Number.parseInt(part || '0', 16) || 0).toString(16)
  );
}
