# How to Add a New Novel

Pocket Reader now supports multiple packaged novels in one app. Do not replace `src/features/reader/data.js` unless you are intentionally replacing *The Friction of the Spark*.

## 1. Add the Book Cartridge

Create a new file under:

```text
src/features/reader/books/<book-slug>.js
```

Use the legacy cartridge shape:

```js
window.PocketReader = window.PocketReader || {};
window.PocketReader.bookContent = [
  {
    chapter: 0,
    isChapterStart: true,
    title: 'COVER',
    content: '<img src="src/assets/images/books/<book-slug>/cover.jpg" class="cover-img" alt="Book Cover">'
  },
  {
    chapter: 1,
    isChapterStart: true,
    title: 'Chapter 1',
    content: '<p>Your chapter text here.</p>'
  }
];
PocketReader.bookContent = window.PocketReader.bookContent;
```

For chunked books, set `isChapterStart: false` on continuation entries.

## 2. Add the Cover

Put the cover in a book-specific folder:

```text
src/assets/images/books/<book-slug>/cover.jpg
```

PNG is also fine. Use the exact path in the cartridge and in the library item.

## 3. Wire the Cartridge

Open `src/features/books/legacyCartridge.ts`.

Add a raw import:

```ts
import myBookSource from '../reader/books/<book-slug>.js?raw';
```

Then export loaded content:

```ts
export const myBookContent = loadLegacyBookContent(myBookSource);
```

## 4. Register the Library Item

Open `src/features/books/libraryData.ts`.

Import the new content export and add a `LibraryItem` entry to `packagedLibrary`:

```ts
{
  id: '<book-slug>',
  type: 'book',
  title: 'My Book Title',
  author: 'Shiminize',
  subtitle: 'Short genre label',
  cover: assetUrlFor('src/assets/images/books/<book-slug>/cover.jpg'),
  description: 'One clear sentence about the book.',
  section: 'Imported Novels',
  tags: ['tag one', 'tag two'],
  totalChapters: myBookContent.length,
  content: myBookContent,
  initialStatus: 'want-to-read'
}
```

## 5. Build and Check

Run:

```bash
npm run build
```

Then open the app and confirm the book appears in Library, opens in Reader, and shows the correct cover.
