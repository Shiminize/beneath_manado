import { describe, expect, it } from 'vitest';
import { buildLegacyReadingSessionGroups, shouldStoreRawAnalyticsEvent } from './database.js';

describe('reading session analytics', () => {
  it('does not store raw page or reading-session rows in reader_events', () => {
    expect(shouldStoreRawAnalyticsEvent({ type: 'page_view' })).toBe(false);
    expect(shouldStoreRawAnalyticsEvent({ type: 'book_open' })).toBe(false);
    expect(shouldStoreRawAnalyticsEvent({ type: 'reading_session_heartbeat' })).toBe(false);
    expect(shouldStoreRawAnalyticsEvent({ type: 'session_start' })).toBe(true);
  });

  it('aggregates legacy page rows into one reading session', () => {
    const rows = [
      legacyRow({ createdAt: '2026-05-05T00:00:00.000Z', eventType: 'book_open', percent: 0 }),
      legacyRow({ createdAt: '2026-05-05T00:00:05.000Z', chapterIndex: 1, pageIndex: 0, percent: 10, durationSeconds: 5 }),
      legacyRow({ createdAt: '2026-05-05T00:00:20.000Z', chapterIndex: 1, pageIndex: 3, percent: 18, durationSeconds: 15 })
    ];

    const groups = buildLegacyReadingSessionGroups(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      siteSessionId: 'site-session-1',
      bookId: 'book-one',
      durationSeconds: 20,
      startChapterIndex: 1,
      startPageIndex: 0,
      lastChapterIndex: 1,
      lastPageIndex: 3,
      maxPercent: 18,
      ipNetwork: '198.51.100.0',
      country: 'US'
    });
  });

  it('splits legacy reading sessions after thirty minutes of inactivity', () => {
    const groups = buildLegacyReadingSessionGroups([
      legacyRow({ createdAt: '2026-05-05T00:00:00.000Z', chapterIndex: 0, pageIndex: 0, percent: 2 }),
      legacyRow({ createdAt: '2026-05-05T00:29:59.000Z', chapterIndex: 0, pageIndex: 4, percent: 5 }),
      legacyRow({ createdAt: '2026-05-05T01:00:01.000Z', chapterIndex: 2, pageIndex: 1, percent: 20 })
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].maxPercent).toBe(5);
    expect(groups[1].startChapterIndex).toBe(2);
  });
});

function legacyRow({
  createdAt,
  eventType = 'page_view',
  chapterIndex = null,
  pageIndex = null,
  percent = null,
  durationSeconds = 0
}) {
  return {
    session_id: 'site-session-1',
    visitor_hash: 'visitor-day-1',
    event_type: eventType,
    book_id: 'book-one',
    chapter_index: chapterIndex,
    page_index: pageIndex,
    percent,
    duration_seconds: durationSeconds,
    ip_network: '198.51.100.0',
    country: 'US',
    created_at: createdAt
  };
}
