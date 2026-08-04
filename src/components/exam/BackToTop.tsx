import { useEffect, useState, type RefObject } from 'react';
import { AnimatePresence, motion, useScroll, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

/**
 * Floating "back to top" button that appears once a long question has been
 * scrolled past ~600px, letting the user jump back to the stem/options quickly.
 * The ring around the button fills to reflect scroll progress through the
 * question body, so the user can gauge how much remains at a glance.
 *
 * Reduced-motion: the entrance/exit collapse to an instant fade (the FAB must
 * still appear/disappear — only the choreography is dropped).
 */
export function BackToTop({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(false);

  // useScroll on a container ref tracks scrollProgress (0..1) through the
  // element's scrollable area. A spring smooths the ring so rapid flicks
  // don't jitter the indicator.
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });

  const R = 20; // ring radius, in viewBox units (FAB is w-11 h-11 = 44px)
  const C = 2 * Math.PI * R;
  // Map 0..1 scroll progress → dashoffset (C = empty, 0 = full ring).
  const dashOffset = useTransform(progress, (v) => C * (1 - v));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setVisible(el.scrollTop > 600);
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollRef]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.9 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 26 }}
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top of question"
          className="hidden md:grid absolute bottom-24 right-6 z-raised w-11 h-11 place-items-center rounded-full bg-surface border border-border-strong text-muted hover:text-text hover:border-primary shadow-lg transition-colors"
        >
          <span className="relative grid place-items-center">
            {/* Scroll-progress ring */}
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44" width={44} height={44} aria-hidden>
              <circle cx="22" cy="22" r={R} fill="none" stroke="var(--surface-3)" strokeWidth={2} />
              <motion.circle
                cx="22"
                cy="22"
                r={R}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray={C}
                style={{ strokeDashoffset: dashOffset }}
              />
            </svg>
            <ArrowUp size={18} />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
