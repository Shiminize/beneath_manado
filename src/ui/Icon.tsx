import type { LucideIcon, LucideProps } from 'lucide-react';
import { cx } from './classes';

export type AppIconSize = 'compact' | 'standard' | 'large' | 'navigation';

const appIconSizeClasses: Record<AppIconSize, string> = {
  compact: 'app-icon-compact',
  standard: 'app-icon-standard',
  large: 'app-icon-large',
  navigation: 'app-icon-navigation'
};

export interface AppIconProps extends Omit<LucideProps, 'size'> {
  icon: LucideIcon;
  size?: AppIconSize;
  decorative?: boolean;
}

export function AppIcon({ icon: Icon, size = 'standard', decorative = true, className, ...props }: AppIconProps) {
  return <Icon className={cx('app-icon', appIconSizeClasses[size], className)} aria-hidden={decorative || undefined} focusable="false" {...props} />;
}
