import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppRoute, AppState, BookContent, ReaderLocation, ReaderPreferences, ReadingStatus } from './app/types';
import { AdminScreen } from './features/admin/AdminScreen';
import { BookAccessOverlay } from './features/access/BookAccessOverlay';
import { trackAnalyticsEvent } from './features/analytics/client';
import { packagedLibrary } from './features/books/libraryData';
import { buildSuggestions } from './features/books/suggestions';
import { BookLockedError, fetchBookContent, unlockBook } from './features/books/contentClient';
import { HomeScreen } from './features/home/HomeScreen';
import { LibraryScreen } from './features/library/LibraryScreen';
import { ReaderScreen } from './features/reader/ReaderScreen';
import { SearchScreen } from './features/search/SearchScreen';
import { loadAppState, saveAppState, setItemStatus, updateSystemCollections } from './features/storage/storageRepository';
import { Navigation } from './ui';

export function App() {
  const items = packagedLibrary;
  const [appState, setAppState] = useState<AppState>(() => loadAppState(items));
  const [route, setRoute] = useState<AppRoute>(() => (window.location.pathname === '/admin' ? { view: 'admin' } : { view: 'home' }));
  const [bookContentById, setBookContentById] = useState<Record<string, BookContent[]>>({});
  const [accessState, setAccessState] = useState<BookAccessState>({ status: 'idle' });
  const activeReadingSession = useRef<ActiveReadingSession | null>(null);
  const suggestions = useMemo(() => buildSuggestions(items, appState), [appState, items]);
  const activeReaderItemId = route.view === 'reader' ? route.itemId : undefined;

  const startActiveReadingSession = useCallback(
    (itemId: string, location: ReaderLocation, percent: number, totalChapters?: number) => {
      const session = {
        itemId,
        location,
        percent,
        totalChapters,
        startedAt: Date.now()
      };
      activeReadingSession.current = session;
      trackAnalyticsEvent(buildReadingSessionEvent('reading_session_start', session));
    },
    []
  );

  const sendReadingSessionHeartbeat = useCallback(() => {
    const session = activeReadingSession.current;
    if (!session || document.visibilityState === 'hidden') return;
    trackAnalyticsEvent(buildReadingSessionEvent('reading_session_heartbeat', session));
  }, []);

  const endActiveReadingSession = useCallback(() => {
    const session = activeReadingSession.current;
    if (!session) return;
    trackAnalyticsEvent(buildReadingSessionEvent('reading_session_end', session));
    activeReadingSession.current = null;
  }, []);

  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  useEffect(() => {
    trackAnalyticsEvent({ type: 'session_start' });
    const handlePageHide = () => {
      endActiveReadingSession();
      trackAnalyticsEvent({ type: 'session_end' });
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [endActiveReadingSession]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        endActiveReadingSession();
        return;
      }

      if (route.view !== 'reader' || !route.location || activeReadingSession.current) return;
      const progress = appState.progress[route.itemId];
      const content = bookContentById[route.itemId];
      startActiveReadingSession(route.itemId, route.location, progress?.percent ?? 0, content?.length);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [appState.progress, bookContentById, endActiveReadingSession, route, startActiveReadingSession]);

  useEffect(() => {
    if (route.view !== 'reader') return;
    const interval = window.setInterval(() => {
      setAppState((current) => {
        const progress = current.progress[route.itemId];
        if (!progress) return current;
        const nextProgress = {
          ...current.progress,
          [route.itemId]: {
            ...progress,
            minutesReadToday: progress.minutesReadToday + 1
          }
        };
        return {
          ...current,
          progress: nextProgress
        };
      });
    }, 60000);

    return () => window.clearInterval(interval);
  }, [route]);

  useEffect(() => {
    if (route.view !== 'reader') return;
    const interval = window.setInterval(sendReadingSessionHeartbeat, 30000);
    return () => window.clearInterval(interval);
  }, [route, sendReadingSessionHeartbeat]);

  const openItem = useCallback(
    async (itemId: string, chapterIndex?: number) => {
      setAccessState({ status: 'loading', itemId, chapterIndex });
      const progress = appState.progress[itemId];
      let content = bookContentById[itemId];

      try {
        if (!content) {
          content = await fetchBookContent(itemId);
          setBookContentById((current) => ({ ...current, [itemId]: content }));
        }
      } catch (error) {
        if (error instanceof BookLockedError) {
          setAccessState({ status: 'locked', itemId, title: error.title, chapterIndex });
          return;
        }

        setAccessState({ status: 'error', itemId, message: error instanceof Error ? error.message : 'Unable to load this book.' });
        return;
      }

      const nextLocation = {
        chapterIndex: chapterIndex ?? progress?.chapterIndex ?? 0,
        pageIndex: chapterIndex === undefined ? progress?.pageIndex ?? 0 : 0
      };
      endActiveReadingSession();
      setRoute({
        view: 'reader',
        itemId,
        location: nextLocation
      });
      setAccessState({ status: 'idle' });
      startActiveReadingSession(itemId, nextLocation, progress?.percent ?? 0, content.length);
    },
    [appState.progress, bookContentById, endActiveReadingSession, startActiveReadingSession]
  );

  const updateProgress = useCallback((itemId: string, location: ReaderLocation, percent: number) => {
    setAppState((current) => {
      const currentProgress = current.progress[itemId];
      if (!currentProgress) return current;

      const progress = {
        ...current.progress,
        [itemId]: {
          ...currentProgress,
          ...location,
          percent,
          status: percent >= 100 ? 'finished' : currentProgress.status === 'new' ? 'reading' : currentProgress.status,
          lastReadAt: new Date().toISOString(),
          finishedAt: percent >= 100 ? currentProgress.finishedAt || new Date().toISOString() : currentProgress.finishedAt
        }
      };

      return {
        ...current,
        progress,
        collections: updateSystemCollections(current.collections, progress)
      };
    });
  }, []);

  const updateActiveReaderProgress = useCallback(
    (location: ReaderLocation, percent: number) => {
      if (!activeReaderItemId) return;
      updateProgress(activeReaderItemId, location, percent);
      const currentContent = bookContentById[activeReaderItemId];
      const session = activeReadingSession.current;
      if (!session || session.itemId !== activeReaderItemId) {
        startActiveReadingSession(activeReaderItemId, location, percent, currentContent?.length);
        return;
      }

      activeReadingSession.current = {
        ...session,
        location,
        percent,
        totalChapters: currentContent?.length
      };
    },
    [activeReaderItemId, bookContentById, startActiveReadingSession, updateProgress]
  );

  const updatePreferences = useCallback((preferences: Partial<ReaderPreferences>) => {
    setAppState((current) => ({
      ...current,
      preferences: { ...current.preferences, ...preferences }
    }));
  }, []);

  const changeStatus = useCallback((itemId: string, status: ReadingStatus) => {
    setAppState((current) => setItemStatus(current, itemId, status));
  }, []);

  const createCollection = useCallback((name: string) => {
    setAppState((current) => {
      const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || Date.now().toString(36)}`;
      if (current.collections.some((collection) => collection.id === id)) return current;
      return {
        ...current,
        collections: [...current.collections, { id, name, itemIds: [], system: false }]
      };
    });
  }, []);

  const addToCollection = useCallback((collectionId: string, itemId: string) => {
    setAppState((current) => ({
      ...current,
      collections: current.collections.map((collection) =>
        collection.id === collectionId && !collection.itemIds.includes(itemId)
          ? { ...collection, itemIds: [...collection.itemIds, itemId] }
          : collection
      )
    }));
  }, []);

  const removeFromCollection = useCallback((collectionId: string, itemId: string) => {
    setAppState((current) => ({
      ...current,
      collections: current.collections.map((collection) =>
        collection.id === collectionId ? { ...collection, itemIds: collection.itemIds.filter((candidate) => candidate !== itemId) } : collection
      )
    }));
  }, []);

  if (route.view === 'reader') {
    const item = items.find((candidate) => candidate.id === route.itemId);
    const content = bookContentById[route.itemId];
    if (!item) return null;
    if (!content) return null;
    const readerItem = { ...item, content };

    return (
      <ReaderScreen
        key={item.id}
        item={readerItem}
        initialLocation={route.location}
        preferences={appState.preferences}
        onClose={() => {
          endActiveReadingSession();
          setRoute({ view: 'home' });
        }}
        onProgressChange={updateActiveReaderProgress}
        onPreferencesChange={updatePreferences}
      />
    );
  }

  if (route.view === 'admin') {
    return <AdminScreen />;
  }

  return (
    <div className="app-shell" data-color-palette={appState.preferences.colorPalette} data-reader-theme={appState.preferences.theme}>
      {route.view === 'home' && (
        <HomeScreen
          items={items}
          state={appState}
          suggestions={suggestions}
          onOpenItem={openItem}
          onNavigateLibrary={(collectionId) => setRoute({ view: 'library', collectionId })}
          onSetDailyGoal={(dailyMinutes) => setAppState((current) => ({ ...current, goal: { ...current.goal, dailyMinutes } }))}
        />
      )}

      {route.view === 'library' && (
        <LibraryScreen
          items={items}
          state={appState}
          initialCollectionId={route.collectionId}
          onOpenItem={openItem}
          onSetStatus={changeStatus}
          onCreateCollection={createCollection}
          onAddToCollection={addToCollection}
          onRemoveFromCollection={removeFromCollection}
        />
      )}

      {route.view === 'search' && <SearchScreen items={items} initialQuery={route.query} onOpenItem={openItem} />}

      <Navigation
        activeView={route.view}
        onNavigate={(view) => {
          if (view === 'library') setRoute({ view: 'library' });
          else if (view === 'search') setRoute({ view: 'search' });
          else setRoute({ view: 'home' });
        }}
      />
      {accessState.status !== 'idle' && (
        <BookAccessOverlay
          status={accessState.status}
          title={accessState.status === 'locked' ? accessState.title : undefined}
          message={accessState.status === 'error' ? accessState.message : undefined}
          onCancel={() => setAccessState({ status: 'idle' })}
          onUnlock={async (password) => {
            if (accessState.status !== 'locked') return;
            await unlockBook(accessState.itemId, password);
            await openItem(accessState.itemId, accessState.chapterIndex);
          }}
        />
      )}
    </div>
  );
}

type BookAccessState =
  | { status: 'idle' }
  | { status: 'loading'; itemId: string; chapterIndex?: number }
  | { status: 'locked'; itemId: string; title: string; chapterIndex?: number }
  | { status: 'error'; itemId?: string; message: string };

type ActiveReadingSession = {
  itemId: string;
  location: ReaderLocation;
  percent: number;
  startedAt: number;
  totalChapters?: number;
};

function buildReadingSessionEvent(type: 'reading_session_start' | 'reading_session_heartbeat' | 'reading_session_end', session: ActiveReadingSession) {
  return {
    type,
    bookId: session.itemId,
    chapterIndex: session.location.chapterIndex,
    pageIndex: session.location.pageIndex,
    percent: session.percent,
    durationSeconds: Math.max(0, Math.round((Date.now() - session.startedAt) / 1000)),
    totalChapters: session.totalChapters
  };
}
