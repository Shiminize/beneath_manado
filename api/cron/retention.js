import { enforceRetention } from '../_lib/database.js';
import { requireMethod, sendJson } from '../_lib/http.js';

function isCronAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  // When CRON_SECRET is set, Vercel sends it as a bearer token on cron invocations.
  // If it is unset, rely on Vercel's platform protection for cron endpoints.
  if (!secret) return true;
  return request.headers.authorization === `Bearer ${secret}`;
}

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['GET'])) return;

  if (!isCronAuthorized(request)) {
    sendJson(response, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  try {
    const result = await enforceRetention();
    sendJson(response, result.ok ? 200 : 503, result);
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message || 'retention_failed' });
  }
}
