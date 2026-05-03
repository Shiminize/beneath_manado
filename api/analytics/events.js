import { recordAnalyticsEvent } from '../_lib/database.js';
import { validateAnalyticsEvent } from '../_lib/analytics-validation.js';
import { getJsonBody, requireMethod, sendJson } from '../_lib/http.js';
import { createRequestIdentity } from '../_lib/privacy.js';
import { getSetupStatus } from '../_lib/security.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['POST'])) return;

  try {
    const body = await getJsonBody(request);
    const result = validateAnalyticsEvent(body);
    if (!result.ok) {
      sendJson(response, 400, { ok: false, error: result.error });
      return;
    }

    const identity = createRequestIdentity(request, process.env.ANALYTICS_HASH_SECRET || process.env.SESSION_SECRET);
    const stored = await recordAnalyticsEvent(result.event, identity);
    sendJson(response, 202, { ok: true, ...stored, setup: getSetupStatus() });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message || 'bad_request' });
  }
}
