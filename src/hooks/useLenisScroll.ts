import { useEffect, useRef, useCallback, useState, type RefObject } from 'react';
import Lenis from 'lenis';

interface UseLenisScrollOptions {
  /** Lerp factor — lower = springier. Apple default: 0.08 */
  lerp?: number;
  /** When true, Lenis is destroyed / not created (e.g. exam takes over scroll) */
  disabled?: boolean;
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
  const { lerp = 0.08, disabled = false } = options;

  useEffect(() => {
    if (disabled) {
      // Tear down any existing instance when disabled (e.g. entering exam)
      if (instanceRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        instanceRef.current.destroy();
        instanceRef.current = null;
        setInstance(null);
      }
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;
    // APK mobile: use native scroll, not Lenis — fixes scroll freeze on Android WebView
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.() === true;
    if (isCoarse || isNative) return;

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
  }, [lerp, disabled]);

  const scrollTo = useCallback(
    (target: string | number | HTMLElement, o?: { offset?: number; duration?: number }) => {
      // Lenis accepts number | string | HTMLElement; our union matches, so a
      // plain call is well-typed — no cast needed.
      instanceRef.current?.scrollTo(target, {
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
