import { getBookRecord, setBookAccess } from '../../../_lib/database.js';
import { getJsonBody, getRouteParam, requireMethod, sendJson } from '../../../_lib/http.js';
import { assertAdmin, encryptDisplayPassword, getSetupStatus, hashPassword } from '../../../_lib/security.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['PATCH'])) return;

  if (!assertAdmin(request)) {
    sendJson(response, 401, { ok: false, error: 'unauthorized', setup: getSetupStatus() });
    return;
  }

  if (!getSetupStatus().hasDatabase) {
    sendJson(response, 503, { ok: false, error: 'database_not_configured', setup: getSetupStatus() });
    return;
  }

  const bookId = getRouteParam(request, 'bookId');
  const book = await getBookRecord(bookId);
  if (!book) {
    sendJson(response, 404, { ok: false, error: 'book_not_found' });
    return;
  }

  try {
    const body = await getJsonBody(request);
    const locked = Boolean(body.locked);
    const hasNewPassword = locked && typeof body.password === 'string' && body.password.length >= 8;
    const passwordHash = locked ? (hasNewPassword ? await hashPassword(body.password) : book.passwordHash) : null;
    const passwordDisplayPayload = hasNewPassword ? encryptDisplayPassword(body.password) : null;

    if (locked && !passwordHash) {
      sendJson(response, 400, { ok: false, error: 'password_required' });
      return;
    }

    const result = await setBookAccess(bookId, { locked, passwordHash, passwordDisplayPayload, hasNewPassword });
    sendJson(response, result.ok ? 200 : 404, result);
  } catch (error) {
    const message = error.message || 'bad_request';
    const setup = getSetupStatus();
    if (message.includes('BOOK_PASSWORD_ENCRYPTION_KEY')) {
      sendJson(response, 503, { ok: false, error: 'book_password_encryption_key_required', message, setup });
      return;
    }

    sendJson(response, 400, { ok: false, error: message });
  }
}
