import { getJsonBody, requireMethod, sendJson } from '../_lib/http.js';
import { createRequestIdentity } from '../_lib/privacy.js';
import { createAdminCookie, getSetupStatus, verifyPassword } from '../_lib/security.js';
import { recordUnlockAttempt, tooManyAttempts } from '../_lib/database.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['POST'])) return;

  const setup = getSetupStatus();
  if (!setup.hasSessionSecret || !setup.hasAdminPasswordHash) {
    sendJson(response, 503, { ok: false, error: 'admin_auth_not_configured', setup });
    return;
  }

  const identity = createRequestIdentity(request, process.env.ANALYTICS_HASH_SECRET || process.env.SESSION_SECRET);
  if (await tooManyAttempts({ target: 'admin', identity, limit: 8, windowMinutes: 15 })) {
    sendJson(response, 429, { ok: false, error: 'too_many_attempts' });
    return;
  }

  try {
    const body = await getJsonBody(request);
    const ok = await verifyPassword(process.env.ADMIN_PASSWORD_HASH, body.password);
    await recordUnlockAttempt({ target: 'admin', identity, ok });

    if (!ok) {
      sendJson(response, 401, { ok: false, error: 'invalid_password' });
      return;
    }

    sendJson(response, 200, { ok: true }, { 'Set-Cookie': createAdminCookie(process.env.SESSION_SECRET) });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message || 'bad_request' });
  }
}
