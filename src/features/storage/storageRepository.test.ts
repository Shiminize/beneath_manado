import { describe, expect, it } from 'vitest';
import type { LibraryItem } from '../../app/types';
import { createInitialState, loadAppState, saveAppState, setItemStatus } from './storageRepository';

const items: LibraryItem[] = [
  {
    id: 'book',
    type: 'book',
    title: 'Book',
    author: 'A',
    subtitle: 'S',
    cover: '',
    description: '',
    section: '',
    tags: [],
    totalChapters: 1,
    wordCount: 1,
    content: [{ chapter: 1, isChapterStart: true, title: 'Chapter', content: '<p>Text</p>' }],
    initialStatus: 'reading'
  }
];

describe('storage repository', () => {
  it('round trips versioned state through storage', () => {
    const storage = new MemoryStorage();
    const state = createInitialState(items);
    state.preferences.fontSize = 22;

    saveAppState(state, storage);
    const loaded = loadAppState(items, storage);

    expect(loaded.preferences.fontSize).toBe(22);
    expect(loaded.progress.book.status).toBe('reading');
  });

  it('defaults reader font to Palatino', () => {
    const state = createInitialState(items);

    expect(state.preferences.fontFamily).toBe('palatino');
  });

  it('updates system collections when status changes', () => {
    const state = createInitialState(items);
    const next = setItemStatus(state, 'book', 'finished');

    expect(next.collections.find((collection) => collection.id === 'finished')?.itemIds).toContain('book');
  });

  it('migrates the old original font preference to the default font', () => {
    const storage = new MemoryStorage();
    const state = createInitialState(items);
    (state.preferences as { fontFamily: string }).fontFamily = 'original';

    saveAppState(state, storage);
    const loaded = loadAppState(items, storage);

    expect(loaded.preferences.fontFamily).toBe('palatino');
  });

  it('defaults legacy state without a color palette to parchment', () => {
    const storage = new MemoryStorage();
    const state = createInitialState(items);
    delete (state.preferences as Partial<typeof state.preferences>).colorPalette;

    saveAppState(state, storage);
    const loaded = loadAppState(items, storage);

    expect(loaded.preferences.colorPalette).toBe('parchment');
  });

  it('normalizes an invalid color palette to parchment', () => {
    const storage = new MemoryStorage();
    const state = createInitialState(items);
    (state.preferences as { colorPalette?: string }).colorPalette = 'plum';

    saveAppState(state, storage);
    const loaded = loadAppState(items, storage);

    expect(loaded.preferences.colorPalette).toBe('parchment');
  });

  it('persists a valid color palette', () => {
    const storage = new MemoryStorage();
    const state = createInitialState(items);
    state.preferences.colorPalette = 'marine';

    saveAppState(state, storage);
    const loaded = loadAppState(items, storage);

    expect(loaded.preferences.colorPalette).toBe('marine');
  });

  it('normalizes legacy curl page turns to fast fade', () => {
    const storage = new MemoryStorage();
    const state = createInitialState(items);
    state.preferences.pageTurnMode = 'curl';

    saveAppState(state, storage);
    const loaded = loadAppState(items, storage);

    expect(loaded.preferences.pageTurnMode).toBe('fade');
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  length = 0;

  clear(): void {
    this.values.clear();
    this.length = 0;
  }

  getItem(key: string): string | null {
    return this.values.get(key) || null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] || null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
    this.length = this.values.size;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
    this.length = this.values.size;
  }
}
