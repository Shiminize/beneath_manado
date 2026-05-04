import { requireMethod, sendJson } from '../_lib/http.js';
import { assertAdmin, getSetupStatus } from '../_lib/security.js';

export default function handler(request, response) {
  if (!requireMethod(request, response, ['GET'])) return;

  const setup = getSetupStatus();

  sendJson(response, 200, {
    ok: true,
    authenticated: assertAdmin(request),
    setup,
    setupRequired: Object.values(setup).some((configured) => !configured)
  });
}
