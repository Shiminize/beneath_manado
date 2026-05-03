import { BookOpen, ChevronRight, Minus, Plus, Star } from 'lucide-react';
import type { AppState, LibraryItem, ReadingProgress, Suggestion } from '../../app/types';
import { AppIcon, BookCover, IconButton } from '../../ui';

interface HomeScreenProps {
  items: LibraryItem[];
  state: AppState;
  suggestions: Suggestion[];
  onOpenItem: (itemId: string) => void;
  onNavigateLibrary: (collectionId?: string) => void;
  onSetDailyGoal: (minutes: number) => void;
}

export function HomeScreen({ items, state, suggestions, onOpenItem, onNavigateLibrary, onSetDailyGoal }: HomeScreenProps) {
  const progressList = Object.values(state.progress);
  const continueItems = items.filter((item) => state.progress[item.id]?.status === 'reading');
  const wantItems = items.filter((item) => state.progress[item.id]?.status === 'want-to-read');
  const minutesRead = progressList.reduce((total, progress) => total + progress.minutesReadToday, 0);
  const dailyGoal = state.goal.dailyMinutes;
  const finishedThisYear = progressList.filter((progress) => isFinishedThisYear(progress)).length;
  const goalPercent = Math.min(100, Math.round((minutesRead / dailyGoal) * 100));

  return (
    <main className="screen screen-home">
      <header className="screen-header home-header">
        <h1>Home</h1>
        <div className="goal-ring" style={{ '--goal-progress': `${goalPercent}%` } as React.CSSProperties}>
          <span>{minutesRead}</span>
          <small>{dailyGoal}</small>
        </div>
      </header>

      <section className="goal-panel" aria-label="Reading goal">
        <div>
          <strong>{finishedThisYear} finished this year</strong>
          <span>{minutesRead} of {dailyGoal} minutes today</span>
        </div>
        <div className="goal-controls">
          <IconButton label="Decrease daily goal" icon={Minus} size="compact" variant="soft" onClick={() => onSetDailyGoal(Math.max(5, dailyGoal - 5))} />
          <IconButton label="Increase daily goal" icon={Plus} size="compact" variant="soft" onClick={() => onSetDailyGoal(Math.min(180, dailyGoal + 5))} />
        </div>
      </section>

      <section className="section-block home-continue-section" aria-labelledby="continue-title">
        <div className="section-title-row">
          <h2 id="continue-title">Continue</h2>
          <button type="button" className="text-button" aria-label="Open Continue collection" onClick={() => onNavigateLibrary('continue')}>
            <AppIcon icon={ChevronRight} size="large" />
          </button>
        </div>
        <div className="continue-rail">
          {continueItems.map((item) => (
            <button key={item.id} type="button" className="continue-card" onClick={() => onOpenItem(item.id)}>
              <BookCover src={item.cover} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.author}</small>
                <small>{state.progress[item.id]?.percent || 0}%</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="section-block home-top-picks-section" aria-labelledby="top-picks-title">
        <h2 id="top-picks-title">Top Picks</h2>
        <div className="top-picks-grid">
          {suggestions.map((suggestion) => {
            const item = items.find((candidate) => candidate.id === suggestion.itemId);
            if (!item) return null;
            const markedWantToRead = suggestion.reason === 'Marked Want to Read';

            return (
              <button key={suggestion.itemId} type="button" className="pick-card" aria-label={`Open ${item.title}`} onClick={() => onOpenItem(suggestion.itemId)}>
                <BookCover src={item.cover} />
                <span className="pick-card-content">
                  {markedWantToRead ? (
                    <span className="pick-card-marker" aria-label={suggestion.reason}>
                      <AppIcon icon={Star} size="standard" fill="currentColor" />
                    </span>
                  ) : (
                    <strong>{suggestion.reason}</strong>
                  )}
                  <small>{item.subtitle}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section-block home-want-section" aria-labelledby="want-title">
        <div className="section-title-row">
          <div>
            <h2 id="want-title">Want to Read</h2>
            <p>Books you’d like to read next.</p>
          </div>
          <button type="button" className="text-button" aria-label="Open Want to Read collection" onClick={() => onNavigateLibrary('want-to-read')}>
            <AppIcon icon={ChevronRight} size="large" />
          </button>
        </div>
        <div className="cover-row">
          {wantItems.map((item) => (
            <button key={item.id} type="button" className="cover-tile" onClick={() => onOpenItem(item.id)}>
              <BookCover src={item.cover} />
              <span className="cover-tile-title">{item.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section-block year-summary" aria-label="Library summary">
        <AppIcon icon={BookOpen} size="large" />
        <strong>{items.length} packaged items</strong>
        <span>{countWords(items)} saved words across books, samples, and PDFs.</span>
      </section>

      <section className="privacy-note" aria-label="Privacy note">
        Reader analytics collect views, reading progress, and approximate network information for owner insight. Full IP addresses are not stored.
      </section>
    </main>
  );
}

function isFinishedThisYear(progress: ReadingProgress): boolean {
  if (!progress.finishedAt) return false;
  return new Date(progress.finishedAt).getFullYear() === new Date().getFullYear();
}

function countWords(items: LibraryItem[]): string {
  const words = items.reduce((total, item) => total + item.wordCount, 0);

  if (words > 1000) return `${Math.round(words / 1000)}k`;
  return String(words);
}
