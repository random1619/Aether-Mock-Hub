import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

export interface PageTransitionProps {
  children: ReactNode;
  /** Disable the rise, keeping only the cross-fade (for dense, scroll-heavy pages). */
  fadeOnly?: boolean;
  className?: string;
}

/**
 * Per-page entrance animation keyed on the route pathname. The key lives in
 * App.tsx's AnimatePresence so exit/enter cross-fade between routes; this
 * component just supplies the initial→animate choreography.
 *
 * Vocabulary matches the app's existing spring house style (Reveal/StatTile):
 * a gentle y-rise + fade with spring physics. Reduced-motion collapses to an
 * instant fade (content is never hidden — same contract as Reveal).
 */
export function PageTransition({ children, fadeOnly = false, className }: PageTransitionProps) {
  const reduce = useReducedMotion();
  // Re-mount on search changes too (e.g. provider filters) so a same-route
  // deep-link swap still animates the entrance.
  const { pathname, search } = useLocation();

  return (
    <motion.div
      key={pathname + search}
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: fadeOnly ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.14 } }}
      transition={reduce ? { duration: 0.18, ease: 'easeOut' } : { type: 'spring', stiffness: 200, damping: 26, mass: 0.8 }}
    >
      {children}
    </motion.div>
  );
}
