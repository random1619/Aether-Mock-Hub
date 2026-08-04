import { type HTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: string; // css color for a leading dot
  children: ReactNode;
}

/* Apple chips: soft tonal pills, no borders. */
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-text-2',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success-fg',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
  info: 'bg-info-soft text-info-fg',
};

export function Badge({ tone = 'neutral', dot, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />}
      {children}
    </span>
  );
}
