export type ReaderAnalyticsEvent = {
  type:
    | 'session_start'
    | 'book_open'
    | 'page_view'
    | 'progress'
    | 'session_end'
    | 'reading_session_start'
    | 'reading_session_heartbeat'
    | 'reading_session_end';
  bookId?: string;
  chapterIndex?: number;
  pageIndex?: number;
  percent?: number;
  durationSeconds?: number;
  totalPages?: number;
  totalChapters?: number;
};

const sessionStorageKey = 'friction-reader-analytics-session';

export function getAnalyticsSessionId(): string {
  const existing = window.sessionStorage.getItem(sessionStorageKey);
  if (existing) return existing;

  const next = crypto.randomUUID();
  window.sessionStorage.setItem(sessionStorageKey, next);
  return next;
}

export function trackAnalyticsEvent(event: ReaderAnalyticsEvent): void {
  const payload = JSON.stringify({
    ...event,
    sessionId: getAnalyticsSessionId()
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon('/api/analytics/events', blob);
    return;
  }

  void fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true
  }).catch(() => undefined);
}
