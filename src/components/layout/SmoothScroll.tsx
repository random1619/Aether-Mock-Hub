import { createContext, useContext, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useLenisScroll } from '@/hooks/useLenisScroll';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import type Lenis from 'lenis';

interface SmoothScrollContextValue {
  /** Programmatic scroll-to with Apple easing */
  scrollTo: (target: string | number | HTMLElement, options?: { offset?: number; duration?: number }) => void;
  /** Recalculate scroll bounds after layout shifts */
  update: () => void;
  /** The raw Lenis instance (null until mounted) */
  instance: Lenis | null;
}

const SmoothScrollContext = createContext<SmoothScrollContextValue | null>(null);

/**
 * Consume the SmoothScroll context. Must be called inside a
 * `<SmoothScrollProvider>`. Returns scrollTo, update, and the
 * raw Lenis instance.
 */
export function useSmoothScroll(): SmoothScrollContextValue {
  const ctx = useContext(SmoothScrollContext);
  if (!ctx) {
    throw new Error('useSmoothScroll must be used within <SmoothScrollProvider>');
  }
  return ctx;
}

interface SmoothScrollProviderProps {
  children: ReactNode;
  /** Lerp factor — lower = springier. Apple default: 0.08 */
  lerp?: number;
}

/**
 * Context provider that initialises Lenis smooth scroll and exposes
 * scrollTo / update / instance to the entire tree.
 *
 * Wrap around your page routes. The provider renders a single
 * `[data-scroll-container]` div wrapping children — Lenis smooths the
 * window scroll, so that div is only a mount anchor.
 */
export function SmoothScrollProvider({ children, lerp = 0.08 }: SmoothScrollProviderProps) {
  const location = useLocation();
  const isExam = location.pathname.startsWith('/exam');
  const { containerRef, scrollTo, update, instance } = useLenisScroll({ lerp, disabled: isExam });
  // Drive the `.apple-reveal` / `.apple-fade-up` / `.apple-scale-in` lifecycle
  // (`is-inview`) — Lenis has no scroll-spy, so an IntersectionObserver does it.
  useScrollReveal(containerRef);

  return (
    <SmoothScrollContext.Provider value={{ scrollTo, update, instance }}>
      <div ref={containerRef} data-scroll-container>
        {children}
      </div>
    </SmoothScrollContext.Provider>
  );
}
