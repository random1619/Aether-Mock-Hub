import { useMemo } from 'react';
import NumberFlow, { type NumberFlowProps } from '@number-flow/react';
import { useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';

export interface AnimatedNumberProps {
  value: number;
  /** 'plain' → integer, 'percent' → integer + %, 'score' → 1 decimal max. */
  format?: 'plain' | 'percent' | 'score';
  suffix?: string;
  className?: string;
}

/**
 * Animated number transitions for stats. Snaps instantly when the user
 * prefers reduced motion (honors the app-wide MotionConfig contract).
 */
export function AnimatedNumber({ value, format = 'plain', suffix, className }: AnimatedNumberProps) {
  const reduce = useReducedMotion();

  const formatOption = useMemo<NumberFlowProps['format']>(() => {
    if (format === 'score') return { maximumFractionDigits: 1 };
    return { maximumFractionDigits: 0 };
  }, [format]);

  return (
    <span className={clsx('tabular-nums inline-block', className)}>
      <NumberFlow
        value={value}
        format={formatOption}
        suffix={format === 'percent' ? '%' : suffix}
        transformTiming={reduce ? { duration: 0 } : { duration: 500, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        spinTiming={reduce ? { duration: 0 } : { duration: 500, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        opacityTiming={reduce ? { duration: 0 } : { duration: 250, easing: 'ease-out' }}
      />
    </span>
  );
}
