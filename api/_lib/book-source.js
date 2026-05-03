import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const metadataPath = join(rootDir, 'src/features/books/bookMetadata.json');
const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));

const inlineContent = {
  'structural-audit-pdf': [
    {
      chapter: 1,
      isChapterStart: true,
      title: 'Structural Audit Notes',
      content:
        '<p>This packaged reference item keeps the PDF collection functional in the no-upload V1 app.</p><p>Cloud uploads and imported documents are deferred until backend storage and privacy rules are defined.</p>'
    }
  ],
  'sample-reader-entry': [
    {
      chapter: 1,
      isChapterStart: true,
      title: 'Reader Sample',
      content:
        '<p>This sample verifies that packaged samples can be filtered, opened, and tracked without adding a Book Store or account system.</p>'
    }
  ]
};

export function listPublicBookMetadata() {
  return metadata.map(toPublicBook);
}

export function getPublicBookMetadata(bookId) {
  const book = metadata.find((candidate) => candidate.id === bookId);
  return book ? toPublicBook(book) : null;
}

export function listSeedBooks() {
  return metadata.map((book) => ({
    ...toPublicBook(book),
    content: loadBookContent(book)
  }));
}

export function getSeedBook(bookId) {
  const book = metadata.find((candidate) => candidate.id === bookId);
  if (!book) return null;

  return {
    ...toPublicBook(book),
    content: loadBookContent(book)
  };
}

function toPublicBook(book) {
  const { serverContentFile: _serverContentFile, serverContentKey: _serverContentKey, ...publicBook } = book;
  return publicBook;
}

function loadBookContent(book) {
  if (book.serverContentKey && inlineContent[book.serverContentKey]) {
    return inlineContent[book.serverContentKey];
  }

  if (!book.serverContentFile) return [];

  const source = readFileSync(join(rootDir, book.serverContentFile), 'utf8');
  const legacyWindow = { PocketReader: {} };
  const pocketReader = legacyWindow.PocketReader;
  const execute = new Function(
    'window',
    'PocketReader',
    `${source}; return window.PocketReader.bookContent || PocketReader.bookContent || [];`
  );

  const content = execute(legacyWindow, pocketReader);
  return content.map((chapter, index) => ({
    chapter: typeof chapter.chapter === 'number' ? chapter.chapter : index + 1,
    isChapterStart: chapter.isChapterStart ?? true,
    title: chapter.title || `Chapter ${index + 1}`,
    content: chapter.content || '',
    book_title: chapter.book_title,
    cover: chapter.cover,
    theme_color: chapter.theme_color
  }));
}
