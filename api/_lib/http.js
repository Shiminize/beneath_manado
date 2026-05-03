export function getJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100_000) {
        reject(new Error('Request body too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    request.on('error', reject);
  });
}

export function sendJson(response, statusCode, payload, headers = {}) {
  response.statusCode = statusCode;
  for (const [key, value] of Object.entries(headers)) {
    response.setHeader(key, value);
  }
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

export function requireMethod(request, response, allowedMethods) {
  if (allowedMethods.includes(request.method)) return true;
  response.setHeader('Allow', allowedMethods.join(', '));
  sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
  return false;
}

export function getRouteParam(request, key) {
  if (request.query && typeof request.query[key] === 'string') return request.query[key];
  const url = new URL(request.url || '/', 'https://pocket-reader.local');
  const parts = url.pathname.split('/').filter(Boolean);
  if (key !== 'bookId') return undefined;
  const booksIndex = parts.indexOf('books');
  return booksIndex === -1 ? undefined : parts[booksIndex + 1];
}

export function getQueryParam(request, key, fallback) {
  const url = new URL(request.url || '/', 'https://pocket-reader.local');
  return url.searchParams.get(key) || fallback;
}

export function methodIs(request, method) {
  return request.method?.toUpperCase() === method;
}
