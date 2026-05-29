import { describe, expect, it } from 'vitest';
import { getRouteParam } from './http.js';

describe('getRouteParam', () => {
  it('extracts a plain bookId from the path', () => {
    const request = { url: '/api/admin/books/book-one/sessions?range=30d', headers: {} };
    expect(getRouteParam(request, 'bookId')).toBe('book-one');
  });

  it('decodes a percent-encoded book id so it matches the stored id', () => {
    const request = { url: '/api/admin/books/book%20one/access', headers: {} };
    expect(getRouteParam(request, 'bookId')).toBe('book one');
  });

  it('prefers a string query param when the platform provides one', () => {
    const request = { url: '/api/admin/books/ignored/access', query: { bookId: 'book-two' }, headers: {} };
    expect(getRouteParam(request, 'bookId')).toBe('book-two');
  });

  it('returns undefined for keys other than bookId', () => {
    const request = { url: '/api/admin/books/book-one/sessions', headers: {} };
    expect(getRouteParam(request, 'other')).toBeUndefined();
  });
});
