import { afterEach, describe, expect, it } from 'vitest';
import { resolveRetentionDays } from './database.js';

describe('resolveRetentionDays', () => {
  const previousRetentionDays = process.env.ANALYTICS_RETENTION_DAYS;

  afterEach(() => {
    if (previousRetentionDays === undefined) {
      delete process.env.ANALYTICS_RETENTION_DAYS;
      return;
    }

    process.env.ANALYTICS_RETENTION_DAYS = previousRetentionDays;
  });

  it('defaults to 90 days when unset', () => {
    expect(resolveRetentionDays(undefined)).toBe(90);
    expect(resolveRetentionDays('')).toBe(90);
  });

  it('honors a valid override', () => {
    expect(resolveRetentionDays('30')).toBe(30);
  });

  it('clamps to a minimum of 1 day', () => {
    expect(resolveRetentionDays('0')).toBe(1);
  });

  it('falls back to 90 for non-numeric values', () => {
    expect(resolveRetentionDays('not-a-number')).toBe(90);
  });

  it('reads the override from process.env by default', () => {
    process.env.ANALYTICS_RETENTION_DAYS = '45';
    expect(resolveRetentionDays()).toBe(45);
  });
});
