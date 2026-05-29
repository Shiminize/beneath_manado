import type {
  AppState,
  Collection,
  LibraryItem,
  PageTurnMode,
  ReaderFontFamily,
  ReaderPreferences,
  ReaderTheme,
  ReadingGoal,
  ReadingProgress,
  ReadingStatus
} from '../../app/types';

const STORAGE_KEY = 'friction-reader-state-v1';
const STATE_VERSION = 1;
const readerFontFamilies = new Set<ReaderFontFamily>(['theme', 'literata', 'source-serif', 'atkinson', 'georgia', 'palatino']);
const readerThemes = new Set<ReaderTheme>(['light', 'dark', 'contrast']);
const pageTurnModes = new Set<PageTurnMode>(['fade', 'scroll']);

const legacyReaderThemes: Record<string, ReaderTheme> = {
  original: 'light',
  paper: 'light',
  calm: 'light',
  focus: 'light',
  quiet: 'dark',
  bold: 'contrast'
};

interface StoredState {
  version: number;
  state: AppState;
}

export const defaultPreferences: ReaderPreferences = {
  theme: 'light',
  fontSize: 18,
  fontFamily: 'palatino',
  boldText: false,
  lineHeight: 1.72,
  characterSpacing: 0,
  wordSpacing: 0,
  marginScale: 1,
  justifyText: false,
  brightness: 1,
  pageTurnMode: 'fade',
  bothMarginsAdvance: false,
  orientationLock: 'off',
  lineGuideEnabled: false,
  lineGuideDimming: 'medium',
  lineGuidePosition: 42
};

export const defaultGoal: ReadingGoal = {
  dailyMinutes: 15,
  yearlyTarget: 15
};

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function defaultCollections(items: LibraryItem[]): Collection[] {
  return [
    { id: 'all', name: 'All', itemIds: items.map((item) => item.id), system: true },
    {
      id: 'continue',
      name: 'Continue',
      itemIds: items.filter((item) => item.initialStatus === 'reading').map((item) => item.id),
      system: true
    },
    {
      id: 'want-to-read',
      name: 'Want to Read',
      itemIds: items.filter((item) => item.initialStatus === 'want-to-read').map((item) => item.id),
      system: true
    },
    { id: 'finished', name: 'Finished', itemIds: [], system: true },
    {
      id: 'samples',
      name: 'Samples',
      itemIds: items.filter((item) => item.type === 'sample').map((item) => item.id),
      system: true
    },
    {
      id: 'pdfs',
      name: 'PDFs',
      itemIds: items.filter((item) => item.type === 'pdf').map((item) => item.id),
      system: true
    }
  ];
}

export function createDefaultProgress(item: LibraryItem): ReadingProgress {
  return {
    itemId: item.id,
    chapterIndex: 0,
    pageIndex: 0,
    status: item.initialStatus,
    percent: 0,
    minutesReadToday: 0,
    minutesReadDate: todayKey()
  };
}

export function createInitialState(items: LibraryItem[]): AppState {
  return {
    progress: Object.fromEntries(items.map((item) => [item.id, createDefaultProgress(item)])),
    preferences: { ...defaultPreferences },
    collections: defaultCollections(items),
    goal: { ...defaultGoal }
  };
}

export function loadAppState(items: LibraryItem[], storage: Storage | undefined = getLocalStorage()): AppState {
  const initialState = createInitialState(items);
  if (!storage) return initialState;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return initialState;

    const parsed = JSON.parse(raw) as StoredState;
    if (parsed.version !== STATE_VERSION) return initialState;

    return normalizeState(parsed.state, initialState, items);
  } catch {
    return initialState;
  }
}

export function saveAppState(state: AppState, storage: Storage | undefined = getLocalStorage()): void {
  if (!storage) return;
  const stored: StoredState = { version: STATE_VERSION, state };
  storage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function normalizeState(state: AppState, initialState: AppState, items: LibraryItem[]): AppState {
  const progress = { ...initialState.progress, ...state.progress };
  const currentDay = todayKey();

  for (const item of items) {
    const itemProgress = progress[item.id] || createDefaultProgress(item);
    progress[item.id] = {
      ...createDefaultProgress(item),
      ...itemProgress,
      minutesReadToday: itemProgress.minutesReadDate === currentDay ? itemProgress.minutesReadToday : 0,
      minutesReadDate: currentDay
    };
  }

  const collections = mergeCollections(initialState.collections, state.collections, items);

  return {
    progress,
    preferences: normalizePreferences(state.preferences),
    collections: updateSystemCollections(collections, progress),
    goal: { ...defaultGoal, ...state.goal }
  };
}

function normalizePreferences(preferences: Partial<ReaderPreferences> | undefined): ReaderPreferences {
  const merged = { ...defaultPreferences, ...preferences };
  return {
    ...merged,
    theme: normalizeReaderTheme(merged.theme),
    fontFamily: normalizeReaderFontFamily(merged.fontFamily),
    pageTurnMode: normalizePageTurnMode(merged.pageTurnMode)
  };
}

function normalizeReaderTheme(theme: unknown): ReaderTheme {
  if (typeof theme === 'string') {
    if (readerThemes.has(theme as ReaderTheme)) return theme as ReaderTheme;
    if (Object.hasOwn(legacyReaderThemes, theme)) return legacyReaderThemes[theme];
  }
  return defaultPreferences.theme;
}

function normalizeReaderFontFamily(fontFamily: unknown): ReaderFontFamily {
  if (fontFamily === 'original') return defaultPreferences.fontFamily;
  if (typeof fontFamily === 'string' && readerFontFamilies.has(fontFamily as ReaderFontFamily)) {
    return fontFamily as ReaderFontFamily;
  }
  return defaultPreferences.fontFamily;
}

function normalizePageTurnMode(pageTurnMode: unknown): PageTurnMode {
  if (typeof pageTurnMode === 'string' && pageTurnModes.has(pageTurnMode as PageTurnMode)) {
    return pageTurnMode as PageTurnMode;
  }
  return defaultPreferences.pageTurnMode;
}

export function updateSystemCollections(collections: Collection[], progress: Record<string, ReadingProgress>): Collection[] {
  return collections.map((collection) => {
    if (!collection.system) return collection;

    if (collection.id === 'continue') {
      return {
        ...collection,
        itemIds: Object.values(progress)
          .filter((itemProgress) => itemProgress.status === 'reading')
          .map((itemProgress) => itemProgress.itemId)
      };
    }

    if (collection.id === 'want-to-read') {
      return {
        ...collection,
        itemIds: Object.values(progress)
          .filter((itemProgress) => itemProgress.status === 'want-to-read')
          .map((itemProgress) => itemProgress.itemId)
      };
    }

    if (collection.id === 'finished') {
      return {
        ...collection,
        itemIds: Object.values(progress)
          .filter((itemProgress) => itemProgress.status === 'finished')
          .map((itemProgress) => itemProgress.itemId)
      };
    }

    return collection;
  });
}

export function setItemStatus(state: AppState, itemId: string, status: ReadingStatus): AppState {
  const current = state.progress[itemId];
  if (!current) return state;

  const progress = {
    ...state.progress,
    [itemId]: {
      ...current,
      status,
      percent: status === 'finished' ? 100 : current.percent,
      finishedAt: status === 'finished' ? new Date().toISOString() : current.finishedAt
    }
  };

  return {
    ...state,
    progress,
    collections: updateSystemCollections(state.collections, progress)
  };
}

function mergeCollections(defaults: Collection[], stored: Collection[], items: LibraryItem[]): Collection[] {
  const knownIds = new Set(items.map((item) => item.id));
  const byId = new Map(defaults.map((collection) => [collection.id, collection]));

  for (const collection of stored || []) {
    byId.set(collection.id, {
      ...collection,
      itemIds: collection.itemIds.filter((itemId) => knownIds.has(itemId))
    });
  }

  return Array.from(byId.values());
}

function getLocalStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}
