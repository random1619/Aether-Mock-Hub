import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useSmoothScroll } from '@/components/layout/SmoothScroll';

// useGSAP is a React hook (not a GSAP plugin), so it isn't registered — only
// ScrollTrigger is. Registering is idempotent and safe at module scope.
gsap.registerPlugin(ScrollTrigger);

/**
 * Locomotive Scroll v5 exposes `.on('scroll', cb)` / `.off(...)` at runtime,
 * but its type defs don't declare them (the LS instance is typed as the class
 * without the EventEmitter surface). This minimal interface types just the
 * event surface we use, so we avoid `any` while staying honest about the cast.
 */
interface LocomotiveScrollEventEmitter {
  on(event: 'scroll', cb: (args: { scroll: { y: number } }) => void): void;
  off(event: 'scroll', cb: (args: { scroll: { y: number } }) => void): void;
}

/**
 * Signature scrubbed, layered-parallax hero (GSAP ScrollTrigger).
 *
 * As the user scrolls past the hero band, the headline rises slowly and fades
 * while the subhead drifts up faster — creating real depth that framer-motion's
 * on-mount tweens can't, because this is *scroll-scrubbed* (tied to the
 * scrollbar position) rather than time-based. This is the canonical
 * ScrollTrigger pattern the gsap-scrolltrigger skill targets.
 *
 * Locomotive Scroll v5 integration: ScrollTrigger uses the default window
 * scroller, but LS smooths the actual scroll position. We drive trigger
 * recalculation off the LS `scroll` event (which fires on the smoothed
 * position) via `ScrollTrigger.update()`, so the parallax tracks the eased
 * scroll rather than the raw wheel input.
 *
 * Reduced-motion: no ScrollTrigger is created — the hero stays in place.
 * Cleanup: all triggers are killed on unmount and the LS scroll listener is
 * detached so navigation away from the Dashboard leaves nothing dangling.
 *
 * @param rootRef ref to the hero band root element (the ScrollTrigger trigger)
 */
export function useHeroParallax(rootRef: React.RefObject<HTMLElement | null>) {
  const { instance } = useSmoothScroll();
  // Keep a stable ref to the LS scroll handler so cleanup can remove it even
  // if `instance` changes identity between renders.
  const lsScrollUnsubscribe = useRef<(() => void) | null>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      // Respect reduced-motion — skip the whole scene.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const headline = root.querySelector<HTMLElement>('.hero-headline');
      const subhead = root.querySelector<HTMLElement>('.hero-sub');
      if (!headline && !subhead) return;

      // Layered parallax: subhead moves faster than headline for depth.
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.6, // 0.6s catch-up → smooth, not 1:1 jittery
        },
      });

      if (headline) {
        tl.to(headline, { y: -80, opacity: 0 }, 0);
      }
      if (subhead) {
        // Faster + starts leaving earlier → reads as foreground layer.
        tl.to(subhead, { y: -140, opacity: 0, duration: 0.7 }, 0);
      }

      // Recalculate triggers on the smoothed scroll position.
      const onLsScroll = () => ScrollTrigger.update();
      if (instance) {
        const emittable = instance as unknown as LocomotiveScrollEventEmitter;
        emittable.on('scroll', onLsScroll);
        lsScrollUnsubscribe.current = () => emittable.off('scroll', onLsScroll);
      }

      return () => {
        lsScrollUnsubscribe.current?.();
        lsScrollUnsubscribe.current = null;
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    },
    { scope: rootRef, dependencies: [instance] },
  );
}
