import { describe, expect, it } from 'vitest';
import { createDailyVisitorHash, maskIpNetwork } from './privacy.js';

describe('privacy helpers', () => {
  it('stores only masked IPv4 networks', () => {
    expect(maskIpNetwork('198.51.100.42')).toBe('198.51.100.0');
  });

  it('stores only masked IPv6 prefixes', () => {
    expect(maskIpNetwork('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:db8:85a3::');
    expect(maskIpNetwork('2001:db8::1')).toBe('2001:db8:0::');
  });

  it('uses daily secret hashes without exposing the raw IP', () => {
    const hash = createDailyVisitorHash({
      ip: '198.51.100.42',
      userAgent: 'reader-test',
      date: new Date('2026-05-03T00:00:00Z'),
      secret: 'test-secret'
    });

    expect(hash).toBeTruthy();
    expect(hash).not.toContain('198.51.100.42');
  });
});
