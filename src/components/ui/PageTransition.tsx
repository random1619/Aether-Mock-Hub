import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { SPRING_DEFAULT, SPRING_SOFT } from '@/lib/motion';

export interface PageTransitionProps {
  children: ReactNode;
  /** Disable the rise, keeping only the cross-fade (for dense, scroll-heavy pages). */
  fadeOnly?: boolean;
  className?: string;
}

/**
 * Apple-fluid page transition: interruptible spring, symmetric enter/exit,
 * materialize (blur arrives with scale). Reduced-motion → short cross-fade.
 * Never hides content when reduced-motion is on — same Reveal contract.
 */
export function PageTransition({ children, fadeOnly = false, className }: PageTransitionProps) {
  const reduce = useReducedMotion();
  const { pathname, search } = useLocation();

  if (reduce) {
    return (
      <motion.div
        key={pathname + search}
        className={className}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    );
  }

  const spring = fadeOnly ? SPRING_DEFAULT : SPRING_SOFT;
  return (
    <motion.div
      key={pathname + search}
      className={className}
      // Hint to promote to its own layer before motion starts (avoids first-frame jank)
      style={{ willChange: 'transform, opacity' } as any}
      initial={{ opacity: 0, y: fadeOnly ? 0 : 14, scale: fadeOnly ? 1 : 0.985, filter: 'blur(6px)' } as any}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' } as any}
      exit={{ opacity: 0, y: fadeOnly ? 0 : -8, scale: fadeOnly ? 1 : 0.99, filter: 'blur(4px)', transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } } as any}
      transition={{ ...spring, delay: 0.02 } as any}
    >
      {children}
    </motion.div>
  );
}
