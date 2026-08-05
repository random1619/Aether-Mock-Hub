import { useEffect, useRef, useCallback, useState, type RefObject } from 'react';
import Lenis from 'lenis';

interface UseLenisScrollOptions {
  /** Lerp factor — lower = springier. Apple default: 0.08 */
  lerp?: number;
  /** Wheel multiplier. Kept for parity with the old provider prop; Lenis folds
      this into `lerp`/`duration`, so it is accepted but currently unused. */
  multiplier?: number;
}

interface UseLenisScrollReturn {
  containerRef: RefObject<HTMLDivElement | null>;
  scrollTo: (target: string | number | HTMLElement, o?: { offset?: number; duration?: number }) => void;
  update: () => void;
  instance: Lenis | null;
}

/**
 * React hook wrapping Lenis smooth scroll with Apple-design defaults.
 *
 * Unlike Locomotive Scroll, Lenis does not need a dedicated scroll container
 * element with special classes — it smooths the window scroll. `containerRef`
 * is still returned so the provider's markup stays identical, but Lenis is
 * constructed against the window (default) and the ref is only a mount anchor.
 *
 * The instance is exposed via state (not a ref) so consumers that depend on it
 * — e.g. the GSAP parallax hook's `dependencies: [instance]` — re-run once
 * Lenis has actually been constructed in the mount effect.
 *
 * Reduced-motion: Lenis is not constructed at all — native scrolling applies.
 */
export function useLenisScroll(options: UseLenisScrollOptions = {}): UseLenisScrollReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<Lenis | null>(null);
  const rafIdRef = useRef<number>(0);
  const [instance, setInstance] = useState<Lenis | null>(null);
  const { lerp = 0.08 } = options;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    const lenis = new Lenis({ lerp, smoothWheel: true });
    instanceRef.current = lenis;
    setInstance(lenis);

    const raf = (time: number) => {
      lenis.raf(time);
      rafIdRef.current = requestAnimationFrame(raf);
    };
    rafIdRef.current = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
      lenis.destroy();
      instanceRef.current = null;
      setInstance(null);
    };
  }, [lerp]);

  const scrollTo = useCallback(
    (target: string | number | HTMLElement, o?: { offset?: number; duration?: number }) => {
      instanceRef.current?.scrollTo(target as never, {
        offset: o?.offset ?? 0,
        duration: o?.duration ?? 0.8,
      });
    },
    [],
  );

  const update = useCallback(() => {
    instanceRef.current?.resize();
  }, []);

  return { containerRef, scrollTo, update, instance };
}
