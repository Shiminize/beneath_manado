import { describe, expect, it } from 'vitest';
import { toAdminBookSummary } from './database.js';

describe('toAdminBookSummary', () => {
  const lockedBook = {
    id: 'book-one',
    title: 'Book One',
    locked: true,
    hasPassword: true,
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$secret',
    passwordDisplay: 'opensesame',
    passwordState: 'visible',
    passwordUpdatedAt: '2026-05-01T00:00:00.000Z',
    // Incidental fields that must not be forwarded to the client.
    content: [{ chapter: 'secret content' }],
    author: 'Author'
  };

  it('never forwards the password hash or book content to the client', () => {
    const summary = toAdminBookSummary(lockedBook, { readingSessions: 3, sessions: 2, maxPercent: 40 });
    expect(summary).not.toHaveProperty('passwordHash');
    expect(summary).not.toHaveProperty('content');
    expect(summary).not.toHaveProperty('author');
  });

  it('maps access fields and merges analytics', () => {
    const summary = toAdminBookSummary(lockedBook, { readingSessions: 3, sessions: 2, maxPercent: 40 });
    expect(summary).toEqual({
      id: 'book-one',
      title: 'Book One',
      locked: true,
      hasPassword: true,
      passwordDisplay: 'opensesame',
      passwordState: 'visible',
      passwordUpdatedAt: '2026-05-01T00:00:00.000Z',
      readingSessions: 3,
      views: 3,
      sessions: 2,
      maxPercent: 40
    });
  });

  it('defaults analytics to zero when a book has no sessions', () => {
    const summary = toAdminBookSummary(
      { id: 'book-two', title: 'Book Two', locked: false, hasPassword: false, passwordDisplay: null, passwordState: 'none', passwordUpdatedAt: null },
      undefined
    );
    expect(summary).toMatchObject({ readingSessions: 0, views: 0, sessions: 0, maxPercent: 0 });
  });
});
