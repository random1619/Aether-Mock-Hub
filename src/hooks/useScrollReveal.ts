import { useEffect, type RefObject } from 'react';

/**
 * Reveal-on-scroll lifecycle for the `.apple-reveal` / `.apple-fade-up` /
 * `.apple-scale-in` CSS, driven by an `IntersectionObserver`.
 *
 * Locomotive Scroll used to add/remove the `is-inview` class as elements
 * entered and left the viewport; Lenis has no such scroll-spy, so this hook
 * restores that behaviour with a native observer. Elements are observed once
 * and the class is toggled both ways, so re-scrolling an element out of view
 * hides it again and the cascade replays on re-entry — matching the original
 * motion design.
 *
 * Observed targets: any element carrying `data-scroll` that also matches one
 * of the reveal classes, plus any `.apple-reveal` / `.apple-fade-up` /
 * `.apple-scale-in` element. `data-scroll-speed` / `data-scroll-sticky` /
 * `data-scroll-section` attributes are Lenis-inert (no-op) and only kept as
 * semantic anchors; they are not required for the reveal to work.
 *
 * Reduced-motion: the observer still runs, but the CSS reduced-motion block
 * forces `opacity: 1; transform: none; transition: none`, so content is simply
 * always visible with no animation. No special-casing needed here.
 *
 * @param rootRef ref to the scroll container whose subtree is observed
 */
export function useScrollReveal(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const SELECTOR = '.apple-reveal, .apple-fade-up, .apple-scale-in';

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle('is-inview', entry.isIntersecting);
        }
      },
      {
        // Fire as the element crosses into the lower ~90% of the viewport so
        // the reveal starts just before it is fully on screen.
        root: null,
        threshold: 0,
        rootMargin: '0px 0px -10% 0px',
      },
    );

    const observeAll = () => {
      root.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => io.observe(el));
    };

    observeAll();

    // Content under the provider is route-driven and can mount after the
    // observer is set up, so watch for newly-added reveal elements.
    const mo = new MutationObserver((mutations) => {
      let added = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          added = true;
          break;
        }
      }
      if (added) observeAll();
    });
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, [rootRef]);
}
