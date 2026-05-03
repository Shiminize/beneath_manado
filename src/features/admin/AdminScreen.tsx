import { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole, RefreshCw, UnlockKeyhole } from 'lucide-react';
import { AppIcon, Button } from '../../ui';

type SetupStatus = {
  hasDatabase: boolean;
  hasSessionSecret: boolean;
  hasAnalyticsHashSecret: boolean;
  hasAdminPasswordHash: boolean;
};

type AdminBook = {
  id: string;
  title: string;
  locked: boolean;
  hasPassword: boolean;
  views: number;
  sessions: number;
  maxPercent: number;
};

type AnalyticsSnapshot = {
  setup: SetupStatus;
  setupRequired?: boolean;
  totals: {
    views: number;
    sessions: number;
    uniqueVisitors: number;
    readMinutes: number;
  };
  books: AdminBook[];
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

export function AdminScreen() {
  const [password, setPassword] = useState('');
  const [range, setRange] = useState('30d');
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAnalytics();
  }, [range]);

  async function loadAnalytics() {
    setLoading(true);
    setMessage(null);
    const response = await fetch(`/api/admin/analytics?range=${range}`, { credentials: 'include' });
    const payload = await response.json().catch(() => ({}));
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

    setLoginRequired(false);
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
      setMessage(payload.error || 'Unable to sign in.');
      return;
    }

    setPassword('');
    await loadAnalytics();
  }

  async function updateBookAccess(bookId: string, locked: boolean, nextPassword: string) {
    setMessage(null);
    const response = await fetch(`/api/admin/books/${bookId}/access`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked, password: nextPassword || undefined })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(payload.error || 'Unable to update book access.');
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
          {setupStatus && <SetupPanel setup={setupStatus} setupRequired />}
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

          <section className="admin-toolbar" aria-label="Analytics filters">
            <label>
              Range
              <select id="admin-range" name="admin-range" value={range} onChange={(event) => setRange(event.target.value)}>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
              </select>
            </label>
          </section>

          {loading ? <p>Loading analytics.</p> : snapshot && <AnalyticsView snapshot={snapshot} onUpdateBookAccess={updateBookAccess} />}
        </>
      )}
    </main>
  );
}

function SetupPanel({ setup, setupRequired }: { setup: SetupStatus; setupRequired?: boolean }) {
  const missing = [
    !setup.hasDatabase && 'DATABASE_URL',
    !setup.hasSessionSecret && 'SESSION_SECRET',
    !setup.hasAnalyticsHashSecret && 'ANALYTICS_HASH_SECRET',
    !setup.hasAdminPasswordHash && 'ADMIN_PASSWORD_HASH'
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
  onUpdateBookAccess
}: {
  snapshot: AnalyticsSnapshot;
  onUpdateBookAccess: (bookId: string, locked: boolean, password: string) => Promise<void>;
}) {
  return (
    <>
      <section className="admin-metrics" aria-label="Analytics totals">
        <Metric label="Views" value={snapshot.totals.views} />
        <Metric label="Sessions" value={snapshot.totals.sessions} />
        <Metric label="Unique visitor-days" value={snapshot.totals.uniqueVisitors} />
        <Metric label="Read minutes" value={snapshot.totals.readMinutes} />
      </section>

      <section className="admin-grid" aria-label="Book access and views">
        {snapshot.books.map((book) => (
          <BookAccessRow key={book.id} book={book} onUpdate={onUpdateBookAccess} />
        ))}
      </section>

      <section className="admin-events" aria-label="Recent behavior">
        <h2>Recent behavior</h2>
        {snapshot.recentEvents.length ? (
          snapshot.recentEvents.map((event) => (
            <article key={`${event.createdAt}-${event.type}-${event.bookId || 'site'}`} className="admin-event">
              <strong>{event.type.replace('_', ' ')}</strong>
              <span>{event.bookId || 'site'} · {event.percent ?? 0}% · {event.durationSeconds ?? 0}s</span>
              <small>{event.ipNetwork} · {event.country} · {new Date(event.createdAt).toLocaleString()}</small>
            </article>
          ))
        ) : (
          <p>No events stored yet.</p>
        )}
      </section>
    </>
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

function BookAccessRow({ book, onUpdate }: { book: AdminBook; onUpdate: (bookId: string, locked: boolean, password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleUpdate(locked: boolean) {
    setSaving(true);
    await onUpdate(book.id, locked, password);
    setPassword('');
    setSaving(false);
  }

  return (
    <article className="admin-book-row">
      <div>
        <strong>{book.title}</strong>
        <span>{book.locked ? 'Password protected' : 'Public'}{book.hasPassword ? ' · password saved' : ''}</span>
        <small>{book.views} views · {book.sessions} sessions · {book.maxPercent}% max depth</small>
      </div>
      <input
        aria-label={`New password for ${book.title}`}
        autoComplete="new-password"
        id={`book-password-${book.id}`}
        name={`book-password-${book.id}`}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="New password"
        type="password"
      />
      <Button type="button" variant="soft" disabled={saving} onClick={() => void handleUpdate(false)}>
        <AppIcon icon={UnlockKeyhole} size="standard" />
        Public
      </Button>
      <Button type="button" variant="filled" disabled={saving || (!book.hasPassword && password.length < 8)} onClick={() => void handleUpdate(true)}>
        <AppIcon icon={LockKeyhole} size="standard" />
        Lock
      </Button>
    </article>
  );
}
