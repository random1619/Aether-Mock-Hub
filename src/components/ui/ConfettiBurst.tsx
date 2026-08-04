import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * A short, one-shot confetti burst fired on mount. Used by the exam ResultModal
 * to celebrate a passing score. Pure CSS/framer — no dependency, no canvas.
 *
 * Design contract:
 *  - Fires exactly once on mount (caller controls *whether* it mounts by
 *    gating on score threshold). Self-disabling under reduced-motion.
 *  - Particles launch from center-top, arc outward with a per-particle angle
 *    and rotation, then fade + fall under a fake gravity via a spring + tween.
 *  - Colors pulled from the app's tonal palette so it reads on-brand across
 *    light/dark themes rather than rainbow party-supply colors.
 *  - Pointer-events:none + aria-hidden — it is decoration, not content.
 */
const COLORS = ['var(--primary)', 'var(--success)', 'var(--info)', 'var(--warning)', 'var(--accent, var(--primary))'];

interface ParticleSpec {
  /** Launch angle in degrees, 0 = straight up. */
  angle: number;
  /** Outward distance in px from origin. */
  distance: number;
  /** Rotation in degrees over the flight. */
  spin: number;
  /** Flight duration in seconds. */
  duration: number;
  /** Size of the particle in px. */
  size: number;
  color: string;
  delay: number;
}

export interface ConfettiBurstProps {
  /** Number of particles. Default 18 is enough to read as "celebration". */
  count?: number;
}

export function ConfettiBurst({ count = 18 }: ConfettiBurstProps) {
  const reduce = useReducedMotion();

  // Deterministic per-particle specs. useMemo keeps them stable across re-renders
  // so the burst doesn't reshuffle on every parent render. Math.random is fine
  // here (this is a runtime effect, not workflow script territory).
  const particles = useMemo<ParticleSpec[]>(() => {
    return Array.from({ length: count }, () => {
      const angle = (Math.random() * 220 - 110); // -110°..+110° (downward fan)
      const distance = 80 + Math.random() * 120;
      const dir = angle >= 0 ? 1 : -1;
      return {
        angle,
        distance,
        spin: (Math.random() * 540 - 270) * dir,
        duration: 0.9 + Math.random() * 0.5,
        size: 6 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.08,
      };
    });
  }, [count]);

  if (reduce) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-0"
    >
      <div className="relative mx-auto h-0 w-0" style={{ left: '50%', top: 80 }}>
        {particles.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180;
          const x = Math.sin(rad) * p.distance;
          const y = -Math.cos(rad) * p.distance; // up first, then gravity in keyframes
          return (
            <motion.span
              key={i}
              initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
              animate={{
                opacity: [1, 1, 0],
                x: [0, x, x + x * 0.15],
                y: [0, y, y + 160],
                rotate: p.spin,
                scale: [1, 0.9, 0.4],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: [0.16, 1, 0.3, 1],
                times: [0, 0.45, 1],
              }}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.size * 0.6,
                background: p.color,
                borderRadius: 2,
                left: -p.size / 2,
                top: -p.size / 2,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
