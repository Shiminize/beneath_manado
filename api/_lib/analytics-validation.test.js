import { describe, expect, it } from 'vitest';
import { validateAnalyticsEvent } from './analytics-validation.js';

describe('analytics validation', () => {
  it('accepts well-formed reader events', () => {
    const result = validateAnalyticsEvent({
      type: 'reading_session_heartbeat',
      sessionId: 'session-12345',
      bookId: 'friction-of-the-spark',
      chapterIndex: 2,
      pageIndex: 4,
      percent: 45,
      durationSeconds: 12
    });

    expect(result.ok).toBe(true);
    expect(result.event.percent).toBe(45);
  });

  it('accepts reading session lifecycle events', () => {
    expect(validateAnalyticsEvent({ type: 'reading_session_start', sessionId: 'session-12345', bookId: 'book-one' }).ok).toBe(true);
    expect(validateAnalyticsEvent({ type: 'reading_session_heartbeat', sessionId: 'session-12345', bookId: 'book-one' }).ok).toBe(true);
    expect(validateAnalyticsEvent({ type: 'reading_session_end', sessionId: 'session-12345', bookId: 'book-one' }).ok).toBe(true);
  });

  it('rejects malformed event types and book ids', () => {
    expect(validateAnalyticsEvent({ type: 'raw_ip', sessionId: 'session-12345' }).ok).toBe(false);
    expect(validateAnalyticsEvent({ type: 'page_view', sessionId: 'session-12345', bookId: '../secret' }).event.bookId).toBeNull();
  });
});
