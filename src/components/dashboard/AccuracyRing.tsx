import { motion } from 'framer-motion';

/** Small circular accuracy gauge. Reused by mock cards and the daily-goal
    panel — pass `label` when the ring represents something other than accuracy. */
export function AccuracyRing({ acc, tone, label }: { acc: number; tone: string; label?: string }) {
  const R = 14;
  const C = 2 * Math.PI * R;
  const color =
    tone === 'success' ? 'var(--success)' : tone === 'warning' ? 'var(--warning)' : tone === 'danger' ? 'var(--danger)' : 'var(--primary)';
  return (
    <div className="relative w-9 h-9 shrink-0" role="img" aria-label={label ?? `Accuracy ${acc}%`}>
      <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
        <circle cx="18" cy="18" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="4" />
        <motion.circle
          cx="18" cy="18" r={R} fill="none"
          stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          whileInView={{ strokeDashoffset: C - (acc / 100) * C }}
          viewport={{ once: true, margin: '-20px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[9px] font-extrabold tabular-nums" style={{ color }}>
        {acc}
      </span>
    </div>
  );
}
