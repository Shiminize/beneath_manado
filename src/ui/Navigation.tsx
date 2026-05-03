import { Home, Library, Search } from 'lucide-react';
import type { AppView } from '../app/types';
import { AppIcon } from './Icon';

interface NavigationProps {
  activeView: AppView;
  onNavigate: (view: 'home' | 'library' | 'search') => void;
}

const navItems = [
  { view: 'home' as const, label: 'Home', Icon: Home },
  { view: 'library' as const, label: 'Library', Icon: Library },
  { view: 'search' as const, label: 'Search', Icon: Search }
];

export function Navigation({ activeView, onNavigate }: NavigationProps) {
  return (
    <nav className="bottom-nav ui-navigation" aria-label="Primary">
      {navItems.map(({ view, label, Icon }) => (
        <button
          key={view}
          type="button"
          className={activeView === view ? 'bottom-nav-item active' : 'bottom-nav-item'}
          aria-current={activeView === view ? 'page' : undefined}
          onClick={() => onNavigate(view)}
        >
          <AppIcon icon={Icon} size="navigation" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
