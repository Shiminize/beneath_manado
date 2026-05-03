import { LockKeyhole } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { AppIcon, Button } from '../../ui';

interface BookAccessOverlayProps {
  status: 'loading' | 'locked' | 'error';
  title?: string;
  message?: string;
  onCancel: () => void;
  onUnlock: (password: string) => Promise<void>;
}

export function BookAccessOverlay({ status, title = 'Protected book', message, onCancel, onUnlock }: BookAccessOverlayProps) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(message || null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onUnlock(password);
      setPassword('');
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Unable to unlock this book.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="access-overlay" role="dialog" aria-modal="true" aria-labelledby="access-title">
      <div className="access-panel">
        <AppIcon icon={LockKeyhole} size="large" />
        <h1 id="access-title">{status === 'loading' ? 'Opening book' : title}</h1>
        {status === 'loading' && <p>Loading protected reader content.</p>}
        {status === 'error' && <p>{message || 'Unable to load this book.'}</p>}
        {status === 'locked' && (
          <form className="access-form" onSubmit={handleSubmit}>
            <p>This book requires a password.</p>
            <input
              aria-label="Book password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
            />
            {error && <span className="access-error">{error}</span>}
            <div className="access-actions">
              <Button type="button" variant="soft" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="filled" disabled={submitting || !password}>
                Unlock
              </Button>
            </div>
          </form>
        )}
        {status !== 'locked' && (
          <div className="access-actions">
            <Button type="button" variant="soft" onClick={onCancel}>
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
