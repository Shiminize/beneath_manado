import type { LucideIcon, LucideProps } from 'lucide-react';
import { cx } from './classes';

export type AppIconSize = 'compact' | 'standard' | 'large';

const appIconSizes: Record<AppIconSize, number> = {
  compact: 14,
  standard: 16,
  large: 20
};

export interface AppIconProps extends Omit<LucideProps, 'size'> {
  icon: LucideIcon;
  size?: AppIconSize;
  decorative?: boolean;
}

export function AppIcon({ icon: Icon, size = 'standard', decorative = true, className, ...props }: AppIconProps) {
  return <Icon className={cx('app-icon', className)} size={appIconSizes[size]} aria-hidden={decorative || undefined} focusable="false" {...props} />;
}
