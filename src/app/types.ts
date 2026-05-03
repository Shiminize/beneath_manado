export type AppView = 'home' | 'library' | 'search' | 'reader' | 'admin';

export type LibraryItemType = 'book' | 'pdf' | 'sample';

export type ReadingStatus = 'reading' | 'want-to-read' | 'finished' | 'new';

export type ReaderTheme = 'original' | 'quiet' | 'paper' | 'bold' | 'calm' | 'focus';

export type ColorPalette = 'sage' | 'oxide' | 'noir' | 'rose' | 'dusk' | 'marine';

export type PageTurnMode = 'curl' | 'fade' | 'scroll';

export type OrientationLock = 'off' | 'portrait' | 'landscape';

export type LineGuideDimming = 'high' | 'medium' | 'low' | 'none';

export type ReaderFontFamily = 'theme' | 'literata' | 'source-serif' | 'atkinson' | 'georgia' | 'palatino';

export interface BookContent {
  chapter: number;
  isChapterStart: boolean;
  title: string;
  content: string;
  book_title?: string;
  cover?: string;
  theme_color?: string;
}

export interface LibraryItem {
  id: string;
  type: LibraryItemType;
  title: string;
  author: string;
  subtitle: string;
  cover: string;
  description: string;
  section: string;
  tags: string[];
  totalChapters: number;
  wordCount: number;
  content: BookContent[];
  initialStatus: ReadingStatus;
}

export interface ReadingProgress {
  itemId: string;
  chapterIndex: number;
  pageIndex: number;
  status: ReadingStatus;
  percent: number;
  lastReadAt?: string;
  finishedAt?: string;
  minutesReadToday: number;
  minutesReadDate: string;
}

export interface ReaderPreferences {
  theme: ReaderTheme;
  colorPalette: ColorPalette;
  fontSize: number;
  fontFamily: ReaderFontFamily;
  boldText: boolean;
  lineHeight: number;
  characterSpacing: number;
  wordSpacing: number;
  marginScale: number;
  justifyText: boolean;
  brightness: number;
  pageTurnMode: PageTurnMode;
  bothMarginsAdvance: boolean;
  orientationLock: OrientationLock;
  lineGuideEnabled: boolean;
  lineGuideDimming: LineGuideDimming;
  lineGuidePosition: number;
}

export interface Collection {
  id: string;
  name: string;
  itemIds: string[];
  system: boolean;
}

export interface ReadingGoal {
  dailyMinutes: number;
  yearlyTarget: number;
}

export interface AppState {
  progress: Record<string, ReadingProgress>;
  preferences: ReaderPreferences;
  collections: Collection[];
  goal: ReadingGoal;
}

export interface Suggestion {
  itemId: string;
  title: string;
  reason: string;
  score: number;
}

export interface ReaderLocation {
  chapterIndex: number;
  pageIndex: number;
}

export type AppRoute =
  | { view: 'home' }
  | { view: 'library'; collectionId?: string }
  | { view: 'search'; query?: string }
  | { view: 'reader'; itemId: string; location?: ReaderLocation }
  | { view: 'admin' };
