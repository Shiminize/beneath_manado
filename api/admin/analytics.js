import { getQueryParam, requireMethod, sendJson } from '../_lib/http.js';
import { getSetupStatus, assertAdmin } from '../_lib/security.js';
import { getAnalyticsSnapshot, listBooksForAdmin } from '../_lib/database.js';

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

  const range = getQueryParam(request, 'range', '30d');
  const bookId = getQueryParam(request, 'bookId', 'all');
  const snapshot = await getAnalyticsSnapshot({ rangeDays: rangeDaysByKey[range] || 30, bookId });
  const accessRows = await listBooksForAdmin();
  const analyticsByBookId = new Map(snapshot.books.map((book) => [book.id, book]));
  const books = accessRows.map((book) => ({
    ...book,
    views: analyticsByBookId.get(book.id)?.views || 0,
    sessions: analyticsByBookId.get(book.id)?.sessions || 0,
    maxPercent: analyticsByBookId.get(book.id)?.maxPercent || 0
  }));
  const { books: _analyticsBookRows, ...snapshotWithoutBooks } = snapshot;

  sendJson(response, 200, {
    ok: true,
    setup: getSetupStatus(),
    range,
    bookId,
    ...snapshotWithoutBooks,
    books,
  });
}
