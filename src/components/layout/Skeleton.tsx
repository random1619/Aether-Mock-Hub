import type { CSSProperties } from 'react';
import { clsx } from 'clsx';

interface SkeletonProps {
  /** Width/height via className (e.g. "h-4 w-32") or style. */
  className?: string;
  style?: CSSProperties;
  /** Circle for avatars/icons; rounded for text/cards. */
  shape?: 'line' | 'block' | 'circle';
}

/**
 * A single shimmering placeholder block. Uses a token-driven surface tone with
 * a soft traveling highlight so loading states read as layout-shaped skeletons
 * instead of a bare spinner — this removes the layout shift that spinner-first
 * loading caused. Honors the global prefers-reduced-motion rule in theme.css.
 */
export function Skeleton({ className, style, shape = 'line' }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={clsx(
        'skeleton relative overflow-hidden bg-surface-2',
        shape === 'circle' ? 'rounded-full' : shape === 'block' ? 'rounded-2xl' : 'rounded-md',
        className,
      )}
      style={style}
    />
  );
}
