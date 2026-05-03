const eventTypes = new Set(['session_start', 'book_open', 'page_view', 'progress', 'session_end']);

export function validateAnalyticsEvent(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  if (!eventTypes.has(body.type)) return { ok: false, error: 'invalid_event_type' };
  if (typeof body.sessionId !== 'string' || body.sessionId.length < 8 || body.sessionId.length > 120) {
    return { ok: false, error: 'invalid_session' };
  }

  const event = {
    type: body.type,
    sessionId: body.sessionId,
    bookId: normalizeString(body.bookId),
    chapterIndex: normalizeNumber(body.chapterIndex),
    pageIndex: normalizeNumber(body.pageIndex),
    percent: clampPercent(body.percent),
    durationSeconds: normalizeDuration(body.durationSeconds),
    totalPages: normalizeNumber(body.totalPages),
    totalChapters: normalizeNumber(body.totalChapters)
  };

  return { ok: true, event };
}

function normalizeString(value) {
  return typeof value === 'string' && /^[a-z0-9-]+$/.test(value) ? value : null;
}

function normalizeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function clampPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeDuration(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.min(60 * 60, Math.round(value));
}
