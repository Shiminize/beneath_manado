import { getBookRecord, recordUnlockAttempt, tooManyAttempts } from '../../_lib/database.js';
import { getJsonBody, getRouteParam, requireMethod, sendJson } from '../../_lib/http.js';
import { createRequestIdentity } from '../../_lib/privacy.js';
import { createBookAccessCookie, getSetupStatus, verifyPassword } from '../../_lib/security.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['POST'])) return;

  const setup = getSetupStatus();
  if (!setup.hasSessionSecret) {
    sendJson(response, 503, { ok: false, error: 'session_secret_not_configured', setup });
    return;
  }

  const bookId = getRouteParam(request, 'bookId');
  const book = await getBookRecord(bookId);
  if (!book) {
    sendJson(response, 404, { ok: false, error: 'book_not_found' });
    return;
  }

  if (!book.locked) {
    sendJson(response, 200, { ok: true }, { 'Set-Cookie': createBookAccessCookie(request, bookId, process.env.SESSION_SECRET) });
    return;
  }

  const identity = createRequestIdentity(request, process.env.ANALYTICS_HASH_SECRET || process.env.SESSION_SECRET);
  if (await tooManyAttempts({ target: `book:${bookId}`, identity, limit: 8, windowMinutes: 15 })) {
    sendJson(response, 429, { ok: false, error: 'too_many_attempts' });
    return;
  }

  try {
    const body = await getJsonBody(request);
    const ok = await verifyPassword(book.passwordHash, body.password);
    await recordUnlockAttempt({ target: `book:${bookId}`, identity, ok });

    if (!ok) {
      sendJson(response, 401, { ok: false, error: 'invalid_password' });
      return;
    }

    sendJson(response, 200, { ok: true }, { 'Set-Cookie': createBookAccessCookie(request, bookId, process.env.SESSION_SECRET) });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message || 'bad_request' });
  }
}
