import type { LucideIcon, LucideProps } from 'lucide-react';
import { cx } from './classes';

export type AppIconSize = 'compact' | 'standard' | 'large' | 'navigation';

const appIconSizes: Record<AppIconSize, string> = {
  compact: 'var(--icon-size-compact)',
  standard: 'var(--icon-size-standard)',
  large: 'var(--icon-size-large)',
  navigation: 'var(--icon-size-navigation)'
};

export interface AppIconProps extends Omit<LucideProps, 'size'> {
  icon: LucideIcon;
  size?: AppIconSize;
  decorative?: boolean;
}

export function AppIcon({ icon: Icon, size = 'standard', decorative = true, className, ...props }: AppIconProps) {
  return <Icon className={cx('app-icon', className)} size={appIconSizes[size]} aria-hidden={decorative || undefined} focusable="false" {...props} />;
}
