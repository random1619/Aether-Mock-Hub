import { useEffect, useRef, useState } from 'react';

/**
 * CustomCursor — a spring-lerped dot + trailing ring that replaces the native
 * pointer on desktop.
 *
 * Design goals
 * ────────────
 *  • Feel native: the small dot tracks the pointer 1:1 (no lag), so aiming is
 *    never off. The larger ring trails with a spring lerp for the "liquid"
 *    feel — lag lives only on the decorative ring, never on the aim point.
 *  • State-aware: hovering interactive elements (a, button, [role=button],
 *    [data-cursor="pointer"]) grows the ring and merges it over the dot;
 *    text fields collapse the dot to a thin caret; a pressed pointer squishes.
 *  • Safe: it only mounts on precise pointers (`pointer: fine`), disables
 *    itself entirely for `prefers-reduced-motion`, never renders on touch, and
 *    has `pointer-events: none` so it can never block a click.
 *
 * Implementation notes
 * ────────────────────
 *  • One rAF loop drives the ring lerp. The dot is updated imperatively in the
 *    same frame to avoid re-rendering React on every mousemove.
 *  • Hover detection uses `pointerover` with `closest()` so it works through
 *    nested elements and component trees.
 *  • No framer-motion dependency here: the loop is cheaper and has zero
 *    re-render cost, which matters for something that runs at 60fps.
 */

const LERP_RING = 0.18; // ring catch-up factor per frame (springiness)

/** Interactive selectors that grow the cursor. */
const INTERACTIVE =
  'a, button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], ' +
  '[data-cursor="pointer"], label, summary, select, .cursor-pointer';
/** Selectors that switch the cursor to a text caret. */
const TEXT = 'input, textarea, [contenteditable="true"], [data-cursor="text"]';
/** Selectors that indicate a dragging affordance. */
const GRAB = '[data-cursor="grab"], .cursor-grab';

type CursorMode = 'default' | 'pointer' | 'text' | 'grab';

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Only enable on precise pointers (mouse/trackpad), never on touch, and
    // respect reduced-motion (which also keeps the native cursor visible).
    const fine = window.matchMedia('(pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setEnabled(fine.matches && !reduced.matches);
    update();
    fine.addEventListener('change', update);
    reduced.addEventListener('change', update);
    return () => {
      fine.removeEventListener('change', update);
      reduced.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    // Target = where the pointer actually is. Current = where the ring is.
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;
    let raf = 0;
    let mode: CursorMode = 'default';
    let pressed = false;
    let visible = false;

    const applyMode = (el: Element | null) => {
      let next: CursorMode = 'default';
      if (el) {
        if (el.closest(TEXT)) next = 'text';
        else if (el.closest(GRAB)) next = 'grab';
        else if (el.closest(INTERACTIVE)) next = 'pointer';
      }
      if (next !== mode) {
        mode = next;
        dot.dataset.mode = mode;
        ring.dataset.mode = mode;
      }
    };

    const setPressed = (p: boolean) => {
      if (p !== pressed) {
        pressed = p;
        dot.dataset.pressed = String(p);
        ring.dataset.pressed = String(p);
      }
    };

    const setVisible = (v: boolean) => {
      if (v !== visible) {
        visible = v;
        dot.dataset.visible = String(v);
        ring.dataset.visible = String(v);
      }
    };

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!visible) {
        // Snap ring to the pointer on first entry so it doesn't fly in.
        cx = tx;
        cy = ty;
        setVisible(true);
      }
    };

    const onOver = (e: PointerEvent) => applyMode(e.target as Element | null);
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);
    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);

    const loop = () => {
      // Ring eases toward the pointer; dot stays locked for accurate aim.
      cx += (tx - cx) * LERP_RING;
      cy += (ty - cy) * LERP_RING;
      dot.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Signal the stylesheet to hide the native cursor while the custom one
    // runs (and restore it on cleanup / unmount / reduced-motion change).
    document.documentElement.classList.add('custom-cursor');

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    document.documentElement.addEventListener('mouseenter', onEnter);

    return () => {
      document.documentElement.classList.remove('custom-cursor');
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.documentElement.removeEventListener('mouseenter', onEnter);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      {/* Trailing ring (decorative lag) */}
      <div ref={ringRef} className="cursor-ring" data-mode="default" data-visible="false" aria-hidden />
      {/* Aim dot (locked to pointer) */}
      <div ref={dotRef} className="cursor-dot" data-mode="default" data-visible="false" aria-hidden />
    </>
  );
}

export default CustomCursor;
