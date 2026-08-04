import { createContext, useContext, type ReactNode } from 'react';
import { useLocomotiveScroll } from '@/hooks/useLocomotiveScroll';
import type LocomotiveScroll from 'locomotive-scroll';

type ScrollInstance = InstanceType<typeof LocomotiveScroll>;

interface SmoothScrollContextValue {
  /** Programmatic scroll-to with Apple easing */
  scrollTo: (target: string | number | HTMLElement, options?: { offset?: number; duration?: number }) => void;
  /** Force LS to recalculate scroll bounds */
  update: () => void;
  /** The raw Locomotive Scroll instance (null until mounted) */
  instance: ScrollInstance | null;
}

const SmoothScrollContext = createContext<SmoothScrollContextValue | null>(null);

/**
 * Consume the SmoothScroll context. Must be called inside a
 * `<SmoothScrollProvider>`. Returns scrollTo, update, and the
 * raw LS instance.
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
  /** Scroll multiplier — 0.95 for premium feel */
  multiplier?: number;
}

/**
 * Context provider that initialises Locomotive Scroll and exposes
 * scrollTo / update / instance to the entire tree.
 *
 * Wrap around your page routes. The provider renders a single
 * `[data-scroll-container]` div wrapping children — that div is
 * the LS viewport.
 */
export function SmoothScrollProvider({ children, lerp = 0.08, multiplier = 0.95 }: SmoothScrollProviderProps) {
  const { containerRef, scrollTo, update, instance } = useLocomotiveScroll({ lerp, multiplier });

  return (
    <SmoothScrollContext.Provider value={{ scrollTo, update, instance }}>
      <div ref={containerRef} data-scroll-container>
        {children}
      </div>
    </SmoothScrollContext.Provider>
  );
}
