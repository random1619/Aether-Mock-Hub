import { type HTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padded?: boolean;
  /** Kept for API compatibility; Apple cards are flat, so this is a no-op. */
  shine?: boolean;
  children: ReactNode;
}

/* Apple card: #f5f5f7 tile, 18px radius, with a faint hairline ring so flat
   cards still separate from the ambient page surface. Hover lifts via the
   shared card-elevated-hover treatment (diffuse shadow + stronger border). */
export function Card({ hover, padded = true, shine: _shine, className, children, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        'relative bg-surface rounded-2xl ring-1 ring-[var(--glass-border)]',
        'transition-[box-shadow,transform,background-color] duration-200 ease-standard',
        hover && 'hover:-translate-y-0.5 card-elevated-hover',
        padded && 'p-5',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, hint, icon, action }: { title: ReactNode; hint?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[15px] font-semibold flex items-center gap-2 text-text tracking-[-0.01em]">
        {icon && <span className="text-primary">{icon}</span>}
        {title}
      </h3>
      {hint && <span className="text-xs text-muted">{hint}</span>}
      {action}
    </div>
  );
}
