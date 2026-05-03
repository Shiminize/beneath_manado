import { describe, expect, it } from 'vitest';
import type { AppState, LibraryItem } from '../../app/types';
import { buildSuggestions } from './suggestions';
import { createInitialState } from '../storage/storageRepository';

const items: LibraryItem[] = [
  {
    id: 'active',
    type: 'book',
    title: 'Active Book',
    author: 'A',
    subtitle: 'A',
    cover: '',
    description: '',
    section: '',
    tags: [],
    totalChapters: 1,
    wordCount: 1,
    content: [{ chapter: 1, isChapterStart: true, title: 'One', content: '<p>Body</p>' }],
    initialStatus: 'reading'
  },
  {
    id: 'finished',
    type: 'book',
    title: 'Finished Book',
    author: 'B',
    subtitle: 'B',
    cover: '',
    description: '',
    section: '',
    tags: [],
    totalChapters: 1,
    wordCount: 1,
    content: [{ chapter: 1, isChapterStart: true, title: 'One', content: '<p>Body</p>' }],
    initialStatus: 'finished'
  }
];

describe('buildSuggestions', () => {
  it('prioritizes unfinished reading items', () => {
    const state: AppState = createInitialState(items);
    state.progress.active.status = 'reading';
    state.progress.finished.status = 'finished';

    const suggestions = buildSuggestions(items, state);

    expect(suggestions[0].itemId).toBe('active');
    expect(suggestions.some((suggestion) => suggestion.itemId === 'finished')).toBe(false);
  });
});
