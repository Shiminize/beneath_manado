import { getBookRecord, listBookReadingSessions } from '../../../_lib/database.js';
import { getQueryParam, getRouteParam, requireMethod, sendJson } from '../../../_lib/http.js';
import { assertAdmin, getSetupStatus } from '../../../_lib/security.js';

const rangeDaysByKey = {
  '7d': 7,
  '30d': 30,
  '90d': 90
};

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['GET'])) return;

  if (!assertAdmin(request)) {
    sendJson(response, 401, { ok: false, error: 'unauthorized', setup: getSetupStatus() });
    return;
  }

  if (!getSetupStatus().hasDatabase) {
    sendJson(response, 503, { ok: false, error: 'database_not_configured', setup: getSetupStatus(), sessions: [], events: [] });
    return;
  }

  const bookId = getRouteParam(request, 'bookId');
  const book = await getBookRecord(bookId);
  if (!book) {
    sendJson(response, 404, { ok: false, error: 'book_not_found' });
    return;
  }

  const range = getQueryParam(request, 'range', '30d');
  const result = await listBookReadingSessions({ bookId, rangeDays: rangeDaysByKey[range] || 30 });
  sendJson(response, 200, {
    ok: true,
    bookId,
    range,
    title: book.title,
    events: result.sessions,
    ...result
  });
}
