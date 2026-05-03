import type { ImgHTMLAttributes } from 'react';
import { cx } from './classes';

export interface BookCoverProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  className?: string;
}

export function BookCover({ src, alt = '', className, loading = 'lazy', ...props }: BookCoverProps) {
  return (
    <span className={cx('book-cover', className)}>
      <img src={src} alt={alt} loading={loading} {...props} />
    </span>
  );
}
