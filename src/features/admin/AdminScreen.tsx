import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  Globe2,
  KeyRound,
  LockKeyhole,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UnlockKeyhole
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AppIcon, Button } from '../../ui';
import { cx } from '../../ui/classes';

type SetupStatus = {
  hasDatabase: boolean;
  hasSessionSecret: boolean;
  hasAnalyticsHashSecret: boolean;
  hasAdminPasswordHash: boolean;
  hasBookPasswordEncryptionKey?: boolean;
};

type PasswordState = 'none' | 'visible' | 'reset_required';

type AdminBook = {
  id: string;
  title: string;
  locked: boolean;
  hasPassword: boolean;
  passwordDisplay?: string | null;
  passwordUpdatedAt?: string | null;
  passwordState: PasswordState;
  readingSessions?: number;
  views: number;
  sessions: number;
  maxPercent: number;
};

type BookReadingSession = {
  bookId?: string;
  startedAt: string;
  lastSeenAt: string;
  endedAt?: string | null;
  ipNetwork: string;
  country: string;
  startChapterIndex?: number | null;
  startPageIndex?: number | null;
  lastChapterIndex?: number | null;
  lastPageIndex?: number | null;
  maxPercent?: number | null;
  durationSeconds?: number | null;
};

type AnalyticsSnapshot = {
  setup: SetupStatus;
  setupRequired?: boolean;
  totals: {
    readingSessions?: number;
    views: number;
    sessions: number;
    uniqueVisitors: number;
    readMinutes: number;
  };
  books: AdminBook[];
  recentSessions?: BookReadingSession[];
  recentEvents: Array<{
    type: string;
    bookId?: string;
    chapterIndex?: number;
    pageIndex?: number;
    percent?: number;
    durationSeconds?: number;
    ipNetwork: string;
    country: string;
    createdAt: string;
  }>;
};

type AdminStatus = {
  setup?: SetupStatus;
  setupRequired?: boolean;
  authenticated?: boolean;
};

export function AdminScreen() {
  const [password, setPassword] = useState('');
  const [range, setRange] = useState('30d');
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    void loadAnalytics();
  }, [range]);

  async function loadAnalytics() {
    const requestId = ++requestRef.current;
    setLoading(true);
    setMessage(null);
    const statusResponse = await fetch('/api/admin/status', { credentials: 'include' });
    const statusPayload: AdminStatus = await statusResponse.json().catch(() => ({}));
    if (requestId !== requestRef.current) return;

    if (!statusResponse.ok) {
      setLoading(false);
      setMessage('Unable to check admin access.');
      return;
    }

    setSetupStatus(statusPayload.setup || null);

    if (!statusPayload.authenticated) {
      setLoginRequired(true);
      setSnapshot(null);
      setLoading(false);
      return;
    }

    // Authenticated: leave the login form regardless of how the analytics fetch resolves.
    setLoginRequired(false);

    const response = await fetch(`/api/admin/analytics?range=${range}`, { credentials: 'include' });
    const payload = await response.json().catch(() => ({}));
    if (requestId !== requestRef.current) return;
    setLoading(false);

    if (response.status === 401) {
      setLoginRequired(true);
      setSetupStatus(payload.setup || null);
      setSnapshot(null);
      return;
    }

    if (!response.ok) {
      setMessage(payload.error || 'Unable to load analytics.');
      return;
    }

    setSetupStatus(payload.setup || null);
    setSnapshot(payload);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(getAdminLoginMessage(payload.error));
      return;
    }

    setPassword('');
    await loadAnalytics();
  }

  async function updateBookAccess(bookId: string, locked: boolean, nextPassword: string) {
    setMessage(null);
    const response = await fetch(`/api/admin/books/${encodeURIComponent(bookId)}/access`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked, password: nextPassword || undefined })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(
        payload.error === 'database_not_configured'
          ? 'Database required before password changes can be saved.'
          : payload.error === 'book_password_encryption_key_required'
            ? 'BOOK_PASSWORD_ENCRYPTION_KEY is required before visible password display can be saved.'
          : payload.error || 'Unable to update book access.'
      );
      return;
    }

    await loadAnalytics();
  }

  return (
    <main className="screen screen-admin">
      <header className="screen-header admin-header">
        <div>
          <h1>Analytics</h1>
          <p>Owner view for reader behavior and book access.</p>
        </div>
        <Button type="button" variant="soft" onClick={() => void loadAnalytics()}>
          <AppIcon icon={RefreshCw} size="standard" />
          Refresh
        </Button>
      </header>

      {loginRequired ? (
        <>
          {setupStatus && <SetupPanel setup={setupStatus} />}
          <form className="admin-login" onSubmit={handleLogin}>
            <AppIcon icon={LockKeyhole} size="large" />
            <h2>Owner password</h2>
            <input
              aria-label="Owner password"
              autoComplete="current-password"
              id="admin-password"
              name="admin-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
            />
            {message && <span className="admin-message">{message}</span>}
            <Button type="submit" variant="filled" disabled={!password}>
              Sign in
            </Button>
          </form>
        </>
      ) : (
        <>
          {message && <div className="admin-message">{message}</div>}
          {snapshot?.setup && <SetupPanel setup={snapshot.setup} setupRequired={snapshot.setupRequired} />}

          {loading ? (
            <p>Loading analytics.</p>
          ) : snapshot && (
            <AnalyticsView
              snapshot={snapshot}
              range={range}
              onRangeChange={setRange}
              onUpdateBookAccess={updateBookAccess}
            />
          )}
        </>
      )}
    </main>
  );
}

function getAdminLoginMessage(error?: string) {
  if (error === 'invalid_password') return 'Incorrect owner password.';
  if (error === 'too_many_attempts') return 'Too many attempts. Wait a few minutes before trying again.';
  if (error === 'admin_auth_not_configured') return 'Admin login is not configured yet.';
  return 'Unable to sign in.';
}

function SetupPanel({ setup, setupRequired }: { setup: SetupStatus; setupRequired?: boolean }) {
  const missing = [
    !setup.hasDatabase && 'DATABASE_URL',
    !setup.hasSessionSecret && 'SESSION_SECRET',
    !setup.hasAnalyticsHashSecret && 'ANALYTICS_HASH_SECRET',
    !setup.hasAdminPasswordHash && 'ADMIN_PASSWORD_HASH',
    !setup.hasBookPasswordEncryptionKey && 'BOOK_PASSWORD_ENCRYPTION_KEY'
  ].filter(Boolean);

  if (!missing.length && !setupRequired) return null;

  return (
    <section className="admin-setup" aria-label="Setup status">
      <strong>Setup required</strong>
      <span>Configure {missing.join(', ')} in Vercel to enable persistent analytics and password controls.</span>
    </section>
  );
}

function AnalyticsView({
  snapshot,
  range,
  onRangeChange,
  onUpdateBookAccess
}: {
  snapshot: AnalyticsSnapshot;
  range: string;
  onRangeChange: (range: string) => void;
  onUpdateBookAccess: (bookId: string, locked: boolean, password: string) => Promise<void>;
}) {
  const totalBooks = snapshot.books.length;
  const lockedBooks = snapshot.books.filter((book) => book.locked).length;
  const publicBooks = totalBooks - lockedBooks;
  const passwordSavedBooks = snapshot.books.filter((book) => book.hasPassword).length;

  return (
    <>
      <section className="admin-command-panel" aria-label="Access control overview">
        <div className="admin-command-copy">
          <span className="admin-eyebrow">Access control</span>
          <h2>Book visibility</h2>
          <p>{lockedBooks} locked, {publicBooks} public, {passwordSavedBooks} with saved passwords.</p>
        </div>

        <div className="admin-access-summary" aria-label="Book access totals">
          <AccessSummary icon={Globe2} label="Public" value={publicBooks} tone="public" />
          <AccessSummary icon={ShieldCheck} label="Locked" value={lockedBooks} tone="locked" />
          <AccessSummary icon={KeyRound} label="Passwords" value={passwordSavedBooks} tone="password" />
        </div>

        <label className="admin-range-control">
          Range
          <select id="admin-range" name="admin-range" value={range} onChange={(event) => onRangeChange(event.target.value)}>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
          </select>
        </label>
      </section>

      <section className="admin-metrics" aria-label="Analytics totals">
        <Metric label="Reading sessions" value={snapshot.totals.readingSessions ?? snapshot.totals.views} />
        <Metric label="Sessions" value={snapshot.totals.sessions} />
        <Metric label="Unique visitor-days" value={snapshot.totals.uniqueVisitors} />
        <Metric label="Read minutes" value={snapshot.totals.readMinutes} />
      </section>

      <section className="admin-grid" aria-label="Book access and reading sessions">
        {snapshot.books.map((book) => (
          <BookAccessRow
            key={book.id}
            book={book}
            canManageAccess={snapshot.setup.hasDatabase}
            range={range}
            onUpdate={onUpdateBookAccess}
          />
        ))}
      </section>

      <section className="admin-events" aria-label="Recent behavior">
        <h2>Recent behavior</h2>
        {(snapshot.recentSessions || []).length ? (
          (snapshot.recentSessions || []).map((session, index) => (
            <article key={`${session.startedAt}-${session.bookId || 'book'}-${index}`} className="admin-event">
              <strong>Reading session</strong>
              <span>{session.bookId || 'book'} · {session.maxPercent ?? 0}% max · {formatDuration(session.durationSeconds)}</span>
              <small>{session.ipNetwork} · {session.country} · {formatSessionWindow(session)}</small>
            </article>
          ))
        ) : (
          <p>No reading sessions stored yet.</p>
        )}
      </section>
    </>
  );
}

function AccessSummary({
  icon,
  label,
  value,
  tone
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: 'public' | 'locked' | 'password';
}) {
  return (
    <article className={cx('admin-access-chip', `admin-access-chip-${tone}`)}>
      <AppIcon icon={icon} size="standard" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="admin-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function BookAccessRow({
  book,
  canManageAccess,
  range,
  onUpdate
}: {
  book: AdminBook;
  canManageAccess: boolean;
  range: string;
  onUpdate: (bookId: string, locked: boolean, password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [readingSessions, setReadingSessions] = useState<BookReadingSession[] | null>(null);
  const sessionsRequestRef = useRef(0);

  useEffect(() => {
    if (sessionsOpen) void loadBookSessions();
  }, [range]);

  async function handleUpdate(locked: boolean) {
    if (!canManageAccess) return;
    setSaving(true);
    await onUpdate(book.id, locked, password);
    setPassword('');
    setSaving(false);
  }

  async function handleToggleSessions() {
    if (sessionsOpen) {
      setSessionsOpen(false);
      return;
    }

    setSessionsOpen(true);
    await loadBookSessions();
  }

  async function loadBookSessions() {
    const requestId = ++sessionsRequestRef.current;
    setSessionsLoading(true);
    setSessionsError(null);

    const response = await fetch(`/api/admin/books/${encodeURIComponent(book.id)}/sessions?range=${range}`, {
      credentials: 'include'
    });
    const payload = await response.json().catch(() => ({}));
    if (requestId !== sessionsRequestRef.current) return;
    setSessionsLoading(false);

    if (!response.ok) {
      setSessionsError(payload.error || 'Unable to load reading sessions.');
      setReadingSessions(null);
      return;
    }

    setReadingSessions(Array.isArray(payload.sessions) ? payload.sessions : []);
  }

  const lockActionLabel = book.locked ? 'Update' : 'Lock';
  const passwordCopy = getBookPasswordCopy(book, password);
  const passwordTooShort = password.length > 0 && password.length < 8;
  const lockNeedsPassword = !book.hasPassword || (book.locked && book.passwordState === 'reset_required');

  return (
    <article className={cx('admin-book-row', book.locked ? 'is-locked' : 'is-public')}>
      <div className="admin-book-main">
        <div className="admin-book-heading">
          <strong>{book.title}</strong>
          <BookStatusBadge book={book} />
        </div>
        <div className="admin-book-stats" aria-label={`${book.title} analytics`}>
          <button
            className="admin-stat-link"
            type="button"
            aria-expanded={sessionsOpen}
            onClick={() => void handleToggleSessions()}
          >
            <AppIcon icon={Eye} size="compact" />
            <span>{book.readingSessions ?? book.views} reading sessions</span>
            <AppIcon icon={sessionsOpen ? ChevronUp : ChevronDown} size="compact" />
          </button>
          <span><AppIcon icon={Activity} size="compact" />{book.sessions} sessions</span>
          <span>{book.maxPercent}% max depth</span>
        </div>
        <div className="admin-depth-bar" aria-label={`${book.maxPercent}% max read depth`}>
          <span style={getProgressStyle(book.maxPercent)} />
        </div>
        {!canManageAccess && <small className="admin-access-disabled">Database required before lock settings can be saved.</small>}
      </div>

      <div className="admin-password-control">
        <label htmlFor={`book-password-${book.id}`}>
          <span>{passwordCopy.label}</span>
          <strong>{passwordCopy.value}</strong>
        </label>
        <input
          aria-label={`Visible password reset for ${book.title}`}
          autoComplete="off"
          disabled={!canManageAccess}
          id={`book-password-${book.id}`}
          name={`book-password-${book.id}`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={canManageAccess ? 'Type visible password reset' : 'Database required'}
          type="text"
        />
        <small>{passwordCopy.helper}</small>
      </div>

      <div className="admin-access-actions" aria-label={`${book.title} access actions`}>
        <Button
          type="button"
          variant={book.locked ? 'soft' : 'filled'}
          disabled={saving || !canManageAccess}
          onClick={() => void handleUpdate(false)}
        >
          <AppIcon icon={UnlockKeyhole} size="standard" />
          Public
        </Button>
        <Button
          type="button"
          variant={book.locked ? 'filled' : 'soft'}
          disabled={!canManageAccess || saving || passwordTooShort || (lockNeedsPassword && password.length < 8)}
          onClick={() => void handleUpdate(true)}
        >
          <AppIcon icon={LockKeyhole} size="standard" />
          {lockActionLabel}
        </Button>
      </div>

      {sessionsOpen && (
        <div className="admin-book-view-panel">
          <div className="admin-book-view-heading">
            <strong>Reading session details</strong>
            <button type="button" className="admin-view-refresh" onClick={() => void loadBookSessions()}>
              <AppIcon icon={RefreshCw} size="compact" />
              Refresh
            </button>
          </div>
          {sessionsLoading ? (
            <p>Loading reading sessions.</p>
          ) : sessionsError ? (
            <p className="admin-message">{sessionsError}</p>
          ) : readingSessions?.length ? (
            <div className="admin-book-view-list">
              {readingSessions.map((session, index) => (
                <article key={`${session.startedAt}-${session.bookId || book.id}-${index}`} className="admin-book-view-item">
                  <strong>{formatSessionWindow(session)}</strong>
                  <span><AppIcon icon={MapPin} size="compact" />{session.ipNetwork} · {session.country}</span>
                  <span>{formatSessionLocation(session)}</span>
                  <span>{formatPercent(session.maxPercent)}</span>
                  <span><AppIcon icon={Clock3} size="compact" />{formatDuration(session.durationSeconds)}</span>
                </article>
              ))}
            </div>
          ) : (
            <p>No reading sessions in this range.</p>
          )}
        </div>
      )}
    </article>
  );
}

function BookStatusBadge({ book }: { book: AdminBook }) {
  const Icon = book.locked ? ShieldCheck : Globe2;
  const label = book.locked ? 'Locked' : 'Public';
  const detail = book.locked ? (book.hasPassword ? 'Password required' : 'Needs password') : 'Readable now';

  return (
    <span className={cx('admin-status-badge', book.locked ? 'is-locked' : 'is-public')}>
      <AppIcon icon={Icon} size="standard" />
      <span>{label}</span>
      <small>{detail}</small>
    </span>
  );
}

function getBookPasswordCopy(book: AdminBook, draftPassword: string) {
  if (draftPassword) {
    return {
      label: 'New visible password',
      value: draftPassword,
      helper: 'This password is visible while editing and will be hashed when saved.'
    };
  }

  if (book.passwordState === 'visible' && book.passwordDisplay) {
    return {
      label: 'Current password',
      value: book.passwordDisplay,
      helper: book.passwordUpdatedAt
        ? `Last changed ${new Date(book.passwordUpdatedAt).toLocaleString()}. Type a new password to change it.`
        : 'Type a new password to change it.'
    };
  }

  if (book.passwordState === 'reset_required' || book.hasPassword) {
    return {
      label: 'Current password',
      value: 'Password not recoverable - reset to display',
      helper: 'This lock was stored as a hash only. Type a new password to make it visible here going forward.'
    };
  }

  return {
    label: 'Stored password',
    value: 'No password set',
    helper: 'Type at least 8 characters, then lock the book.'
  };
}

function formatChapterPage(chapterIndex?: number | null, pageIndex?: number | null) {
  const chapter = typeof chapterIndex === 'number' ? `Chapter ${chapterIndex + 1}` : 'Chapter unknown';
  const page = typeof pageIndex === 'number' ? `Page ${pageIndex + 1}` : 'Page unknown';
  return `${chapter} · ${page}`;
}

function formatSessionLocation(session: BookReadingSession) {
  return `${formatChapterPage(session.startChapterIndex, session.startPageIndex)} -> ${formatChapterPage(session.lastChapterIndex, session.lastPageIndex)}`;
}

function formatSessionWindow(session: BookReadingSession) {
  const start = new Date(session.startedAt).toLocaleString();
  const end = session.endedAt || session.lastSeenAt;
  return end ? `${start} -> ${new Date(end).toLocaleString()}` : start;
}

function formatPercent(percent?: number | null) {
  return `${Math.max(0, Math.min(100, Number(percent || 0)))}% read`;
}

function formatDuration(seconds?: number | null) {
  const value = Math.max(0, Number(seconds || 0));
  if (value < 60) return `${value}s`;
  return `${Math.round(value / 60)}m`;
}

function getProgressStyle(maxPercent: number): CSSProperties {
  const boundedPercent = Math.min(100, Math.max(0, maxPercent));
  return { '--admin-progress': `${boundedPercent}%` } as CSSProperties;
}
