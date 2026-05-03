import { getBookRecord } from '../../_lib/database.js';
import { getRouteParam, requireMethod, sendJson } from '../../_lib/http.js';
import { getSetupStatus, readBookAccess } from '../../_lib/security.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['GET'])) return;

  const bookId = getRouteParam(request, 'bookId');
  const book = await getBookRecord(bookId);
  if (!book) {
    sendJson(response, 404, { ok: false, error: 'book_not_found' });
    return;
  }

  const hasAccess = !book.locked || readBookAccess(request).includes(bookId);
  if (!hasAccess) {
    sendJson(response, 423, {
      ok: false,
      error: 'book_locked',
      bookId,
      title: book.title,
      setup: getSetupStatus()
    });
    return;
  }

  sendJson(response, 200, {
    ok: true,
    bookId,
    totalChapters: book.totalChapters,
    content: book.content
  });
}
