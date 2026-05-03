import type { BookContent } from '../../app/types';
import { rewriteLegacyAssetPaths } from './assets';

export class BookLockedError extends Error {
  bookId: string;
  title: string;

  constructor(bookId: string, title: string) {
    super('Book is locked.');
    this.name = 'BookLockedError';
    this.bookId = bookId;
    this.title = title;
  }
}

export async function fetchBookContent(bookId: string): Promise<BookContent[]> {
  const response = await fetch(`/api/books/${bookId}/content`, {
    credentials: 'include'
  });
  const payload = await safeJson(response);

  if (response.status === 423) {
    throw new BookLockedError(bookId, payload.title || 'Protected book');
  }

  if (!response.ok || !Array.isArray(payload.content)) {
    throw new Error(payload.error || 'Unable to load this book.');
  }

  return payload.content.map((chapter: BookContent) => ({
    ...chapter,
    content: rewriteLegacyAssetPaths(chapter.content || ''),
    cover: chapter.cover ? rewriteLegacyAssetPaths(`"${chapter.cover}"`).slice(1, -1) : chapter.cover
  }));
}

export async function unlockBook(bookId: string, password: string): Promise<void> {
  const response = await fetch(`/api/books/${bookId}/unlock`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const payload = await safeJson(response);

  if (!response.ok) {
    throw new Error(payload.error === 'invalid_password' ? 'Incorrect password.' : payload.error || 'Unable to unlock this book.');
  }
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
