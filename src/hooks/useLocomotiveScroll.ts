import { useEffect, useRef, useCallback, type RefObject } from 'react';
import type LocomotiveScroll from 'locomotive-scroll';

type ScrollInstance = InstanceType<typeof LocomotiveScroll>;

interface UseLocomotiveScrollOptions {
  /** Whether to enable smooth scrolling (default: true) */
  smooth?: boolean;
  /** Lerp factor — lower = springier. Apple default: 0.08 */
  lerp?: number;
  /** Scroll multiplier — 0.95 for premium feel */
  multiplier?: number;
  /** Whether scroll-triggered classes repeat on re-entry */
  repeat?: boolean;
  /** Smartphone breakpoint in px (below = no smooth) */
  mobileBreakpoint?: number;
  /** Tablet breakpoint in px (below = reduced lerp) */
  tabletBreakpoint?: number;
}

interface UseLocomotiveScrollReturn {
  /** Ref to attach to the scroll container element */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Programmatic scroll-to with Apple easing */
  scrollTo: (target: string | number | HTMLElement, options?: { offset?: number; duration?: number }) => void;
  /** Force LS to recalculate scroll bounds (call after layout shifts) */
  update: () => void;
  /** The raw Locomotive Scroll instance (null until mounted) */
  instance: ScrollInstance | null;
}

const DEFAULT_OPTIONS: Required<UseLocomotiveScrollOptions> = {
  smooth: true,
  lerp: 0.08,
  multiplier: 0.95,
  repeat: false,
  mobileBreakpoint: 768,
  tabletBreakpoint: 1024,
};

/**
 * React hook wrapping Locomotive Scroll v5 with Apple-design defaults.
 *
 * Usage:
 *   const { containerRef, scrollTo, update } = useLocomotiveScroll();
 *   return <div ref={containerRef} data-scroll-container>...</div>
 *
 * Automatically disables smooth scrolling when prefers-reduced-motion
 * is set, and on mobile devices below the breakpoint.
 */
export function useLocomotiveScroll(
  options: UseLocomotiveScrollOptions = {},
): UseLocomotiveScrollReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ScrollInstance | null>(null);
  const opts = { ...DEFAULT_OPTIONS, ...options };

  useEffect(() => {
    // Respect reduced-motion — disable smooth entirely
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    const container = containerRef.current;
    if (!container) return;

    let scroll: ScrollInstance | null = null;

    // Dynamic import so LS is only fetched when used
    import('locomotive-scroll').then(({ default: LocomotiveScroll }) => {
      // Avoid double-init (React Strict Mode)
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }

      scroll = new (LocomotiveScroll as any)({
        el: container,
        smooth: opts.smooth,
        lerp: opts.lerp,
        multiplier: opts.multiplier,
        class: 'is-inview',
        repeat: opts.repeat,
        smartphone: {
          smooth: false,
          breakpoint: opts.mobileBreakpoint,
        },
        tablet: {
          smooth: true,
          breakpoint: opts.tabletBreakpoint,
          lerp: 0.06, // slightly faster on tablets for responsiveness
        },
      });

      instanceRef.current = scroll;
      document.documentElement.classList.add('locomotive-scroll-enabled');
    });

    return () => {
      scroll?.destroy();
      instanceRef.current = null;
      document.documentElement.classList.remove('locomotive-scroll-enabled');
    };
  }, [opts.smooth, opts.lerp, opts.multiplier, opts.repeat, opts.mobileBreakpoint, opts.tabletBreakpoint]);

  const scrollTo = useCallback(
    (target: string | number | HTMLElement, scrollOpts?: { offset?: number; duration?: number }) => {
      (instanceRef.current as any)?.scrollTo(target, {
        offset: scrollOpts?.offset ?? 0,
        duration: scrollOpts?.duration ?? 800,
        easing: [0.16, 1, 0.3, 1] as any, // Apple spring-out
      });
    },
    [],
  );

  const update = useCallback(() => {
    (instanceRef.current as any)?.update();
  }, []);

  return {
    containerRef,
    scrollTo,
    update,
    instance: instanceRef.current,
  };
}
