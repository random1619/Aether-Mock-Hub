import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';

interface RailProps {
  /** Optional heading rendered above the rail (with the arrow controls). */
  title?: ReactNode;
  hint?: string;
  icon?: ReactNode;
  children: ReactNode;
  /** px to scroll per arrow click (roughly one card width + gap). */
  scrollBy?: number;
}

/** Cinematic edge-to-edge horizontal rail: snap-scroll, drag-to-scroll, and
    arrow controls that appear only when overflow exists. Cards stretch past
    the container's right edge so the row reads as "gliding", like Netflix.
    Parent supplies the cards (each should be `snap-start shrink-0`). */
export function Rail({ title, hint, icon, children, scrollBy = 340 }: RailProps) {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < max - 8);
  };

  /* Mount-once observer for container resizes. Also cancels any in-flight
     momentum coast on unmount so it can't write to a detached element. */
  useEffect(() => {
    update();
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    const ctl = inertiaCtl; // capture the stable ref for the cleanup
    ro.observe(el);
    return () => {
      ro.disconnect();
      ctl.current.stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(update);

  const nudge = (dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * scrollBy, behavior: 'smooth' });
  };

  /* Drag-to-scroll (pointer events unify mouse + touch), with momentum.
     On release the rail coasts: the pointer's flick velocity is sampled
     during the drag and fed to a framer-motion `inertia` animation on
     scrollLeft, decaying and clamping to the scrollable bounds. This is the
     Popmotion inertia pattern (skill: react-spring-physics) implemented with
     the already-installed framer-motion `animate()` — no new dependency.
     Reduced-motion: the coast is skipped, the rail just holds its position. */
  const drag = useRef({
    startX: 0,
    scrollLeft: 0,
    active: false,
    moved: false,
    lastX: 0,
    lastT: 0,
    velocity: 0, // px/ms, signed; positive = dragging right
  });
  // Keep a ref to the in-flight inertia animation so a new drag cancels it.
  const inertiaCtl = useRef<{ stop?: () => void }>({});

  const onPointerDown = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    inertiaCtl.current.stop?.(); // cancel any coasting from a prior flick
    drag.current = {
      startX: e.clientX, scrollLeft: el.scrollLeft, active: true, moved: false,
      lastX: e.clientX, lastT: e.timeStamp, velocity: 0,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el || !drag.current.active) return;
    if (Math.abs(e.clientX - drag.current.startX) > 6) drag.current.moved = true;
    el.scrollLeft = drag.current.scrollLeft - (e.clientX - drag.current.startX);
    // Sample velocity (px/ms). Ignore a zero-dt frame to avoid div-by-zero.
    const dt = e.timeStamp - drag.current.lastT;
    if (dt > 0) {
      drag.current.velocity = (e.clientX - drag.current.lastX) / dt;
      drag.current.lastX = e.clientX;
      drag.current.lastT = e.timeStamp;
    }
  };
  const endDrag = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    const el = trackRef.current;
    if (!el || reduce) return;
    // The flick moves the *content* opposite to pointer direction (drag right
    // → scrollLeft decreases). Negate pointer velocity for scroll velocity.
    const velocityPxPerMs = -drag.current.velocity;
    // px/ms → px/s; below threshold (~0.3 px/ms ≈ a firm push) just settle.
    if (Math.abs(velocityPxPerMs) < 0.3) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const from = el.scrollLeft;
    const target = from + velocityPxPerMs * 1000 * 0.6; // project ~0.6s of travel
    const clamped = Math.max(0, Math.min(max, target));
    const controls = animate(from, clamped, {
      type: 'inertia',
      velocity: velocityPxPerMs * 1000, // px/s, framer-motion inertia uses px/s
      power: 0.6,            // how far the projection reaches
      timeConstant: 350,     // decay rate (ms)
      modifyTarget: (v) => Math.max(0, Math.min(max, v)),
      bounceStiffness: 400,  // gentle settle at the bounds
      bounceDamping: 26,
      restSpeed: 0.01,
      onUpdate: (v) => { if (el) el.scrollLeft = v; },
    });
    inertiaCtl.current.stop = () => controls.stop();
  };
  const swallowDragClick = (e: React.SyntheticEvent) => {
    if (!drag.current.moved) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current.moved = false;
  };

  return (
    <section className="relative group/rail">
      {(title || hint) && (
        <div className="flex items-end justify-between mb-4 px-4 sm:px-6">
          <div>
            <h2 className="rail-title text-xl sm:text-[22px] font-bold tracking-[-0.02em] text-text flex items-center gap-2.5">
              {icon && <span className="text-primary">{icon}</span>}
              {title}
            </h2>
            {hint && <p className="rail-hint text-[13px] text-muted mt-0.5">{hint}</p>}
          </div>
          {!isNetflix && (
            <div className="hidden sm:flex items-center gap-2">
              <RailButton dir={-1} disabled={!canLeft} onClick={() => nudge(-1)} />
              <RailButton dir={1} disabled={!canRight} onClick={() => nudge(1)} />
            </div>
          )}
        </div>
      )}

      {/* Netflix Full-Height Left Arrow */}
      {isNetflix && canLeft && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => nudge(-1)}
          aria-label="Scroll left"
          className="rail-handle left-0 hidden sm:flex"
        >
          <ChevronLeft size={28} />
        </motion.button>
      )}

      {/* Track */}
      <div
        ref={trackRef}
        tabIndex={0}
        role="region"
        aria-label={typeof title === 'string' ? `${title} carousel` : 'Scrollable carousel'}
        onScroll={update}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={swallowDragClick}
        className={clsx(
          'rail-track flex gap-5 overflow-x-auto snap-x snap-mandatory pb-2',
          'px-4 sm:px-6 scroll-px-4 sm:scroll-px-6',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'cursor-grab active:cursor-grabbing select-none',
        )}
      >
        {children}
      </div>

      {/* Netflix Full-Height Right Arrow */}
      {isNetflix && canRight && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => nudge(1)}
          aria-label="Scroll right"
          className="rail-handle right-0 hidden sm:flex"
        >
          <ChevronRight size={28} />
        </motion.button>
      )}

      {/* Edge fade for default theme */}
      {!isNetflix && canRight && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-bg to-transparent hidden sm:block"
        />
      )}
    </section>
  );
}

function RailButton({ dir, disabled, onClick }: { dir: 1 | -1; disabled: boolean; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 1 ? 'Scroll right' : 'Scroll left'}
      whileTap={disabled ? undefined : { scale: 0.86 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      className={clsx(
        'w-8 h-8 grid place-items-center rounded-full ring-1 ring-[var(--glass-border)] transition-colors',
        disabled
          ? 'bg-surface-2 text-muted opacity-40 cursor-default'
          : 'bg-surface-2 text-text-2 hover:bg-surface-3 hover:text-text shadow-sm',
      )}
    >
      {dir === 1 ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
    </motion.button>
  );
}
