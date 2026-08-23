import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { AnimatedNumber } from '@/components/ui';

export type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatTileProps {
  icon: ReactNode;
  /** Numeric value; null renders an em-dash placeholder. */
  value: number | null;
  /** Number formatting passed through to AnimatedNumber. */
  format?: 'plain' | 'percent' | 'score';
  label: string;
  /** Optional trailing sub-label (e.g. "(3/10)") shown muted after the label. */
  sub?: string;
  tone?: StatTone;
  className?: string;
}

/* Tonal icon chip colors, aligned with Badge tones. */
const chips: Record<StatTone, string> = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success-fg',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
  info: 'bg-info-soft text-info-fg',
  neutral: 'bg-surface-2 text-muted',
};

/**
 * The single stat-tile used by the dashboard hero strip and the Analytics
 * summary grid — a tinted icon chip, a large animated numeral, and a muted
 * label on a hairline-ringed card with Apple tactile spring physics.
 */
export function StatTile({ icon, value, format = 'plain', label, sub, tone = 'neutral', className }: StatTileProps) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 25 }}
      className={clsx(
        'rounded-2xl bg-surface p-3.5 sm:p-5 min-w-0 ring-1 ring-[var(--glass-border)] shadow-sm',
        'card-elevated-hover transition-colors duration-200',
        className,
      )}
    >
      <div className={clsx('w-7 h-7 sm:w-8 sm:h-8 grid place-items-center rounded-full transition-transform group-hover:scale-110', chips[tone])}>
        {icon}
      </div>
      <div className="text-2xl sm:text-4xl font-bold text-text tabular-nums leading-none tracking-[-0.02em] mt-2 sm:mt-3">
        {value === null ? '—' : <AnimatedNumber value={value} format={format} />}
      </div>
      <div className="text-xs sm:text-[13px] text-muted font-medium mt-1 sm:mt-1.5 truncate">
        {label}
        {sub && <span className="ml-1 tabular-nums">({sub})</span>}
      </div>
    </motion.div>
  );
}
