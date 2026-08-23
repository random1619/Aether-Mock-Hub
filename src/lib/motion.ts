/**
 * Apple Fluid Motion primitives — distilled from WWDC "Designing Fluid Interfaces"
 * (2018) into web-ready helpers. Import these instead of ad-hoc easing numbers.
 *
 * • Springs are interruptible & velocity-aware — the core tool.
 * • Projection decides the landing target from momentum.
 * • Rubber-banding gives soft boundaries.
 *
 * Motion tokens below map 1:1 to the table in the skill doc. Prefer these presets
 * over invented stiffness/damping pairs.
 */

// ── Canonical Apple spring presets ──────────────────────────────────────────
// Damping 1.0 = critically damped (no bounce). 0.8 = slight overshoot for flicks.
// Response ≈ Motion's `duration` (seconds to settle). Mass is folded in.
/** Apple defaults: damping 1.0, response 0.3–0.4. Gentle, non-distracting. */
export const SPRING_DEFAULT = {
  type: 'spring' as const,
  stiffness: 340,
  damping: 32,
  mass: 1,
  // framer-motion spring mapping close to Apple's damping 1.0 / response 0.36
} as const;

/** Momentum / flick interaction: damping ~0.8, response ~0.36 — a touch of bounce. */
export const SPRING_MOMENTUM = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 24,
  mass: 0.9,
} as const;

/** Drawer / sheet — snappy, light bounce (WWDC: damping 0.8, response 0.3). */
export const SPRING_DRAWER = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 26,
  mass: 0.8,
} as const;

/** Modal / popover — heavier surface, no bounce, materialize. */
export const SPRING_MODAL = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 38,
  mass: 0.9,
} as const;

/** Soft large surface — hero reveals, bento cards. */
export const SPRING_SOFT = {
  type: 'spring' as const,
  stiffness: 220,
  damping: 26,
  mass: 1,
} as const;

/** Press / tap — instant feedback on pointer-down. */
export const SPRING_PRESS = {
  type: 'spring' as const,
  stiffness: 600,
  damping: 30,
  mass: 0.6,
} as const;

// For Motion / Framer Motion `bounce` + `duration` API (alternative):
//   default: { type:'spring', bounce:0, duration:0.36 }  // damping 1.0
//   momentum:{ type:'spring', bounce:0.18, duration:0.36 } // damping 0.8

// ── Projection — where is the gesture going? ────────────────────────────────
// Apple's exponential-decay form (NOT v²/2decel). Used by scroll deceleration.
export function projectMomentum(
  initialVelocity: number, // px/s
  decelerationRate = 0.998,
): number {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

export function projectedPoint(
  currentPosition: number,
  velocityPxPerSec: number,
  decelerationRate = 0.998,
): number {
  return currentPosition + projectMomentum(velocityPxPerSec, decelerationRate);
}

// ── Rubber-banding — progressive resistance past bounds ─────────────────────
export function rubberband(
  overshoot: number, // px past the bound (signed)
  dimension: number, // scrollable dimension length
  constant = 0.55,
): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export function applyRubberband(
  value: number,
  min: number,
  max: number,
  constant = 0.55,
): number {
  if (value < min) return min + rubberband(value - min, max - min, constant);
  if (value > max) return max + rubberband(value - max, max - min, constant);
  return value;
}

// ── Velocity handoff ────────────────────────────────────────────────────────
/** Relative velocity for spring APIs that want normalized 0–1 velocity. */
export function relativeVelocity(
  gestureVelocity: number, // px/s
  currentValue: number,
  targetValue: number,
): number {
  const dist = targetValue - currentValue;
  if (Math.abs(dist) < 0.001) return 0;
  return gestureVelocity / dist;
}

// ── Utilities ───────────────────────────────────────────────────────────────
// Detect if user prefers reduced motion (honor it everywhere).
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Clamp + nearest snap helper for rails / carousels.
export function nearestSnapPoint(projected: number, points: number[]): number {
  if (!points.length) return projected;
  let best = points[0];
  let bestDist = Math.abs(projected - points[0]);
  for (let i = 1; i < points.length; i++) {
    const d = Math.abs(projected - points[i]);
    if (d < bestDist) {
      bestDist = d;
      best = points[i];
    }
  }
  return best;
}
