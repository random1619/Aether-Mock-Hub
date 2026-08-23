import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { TripleRingsData } from '@/services/gamificationService';
import { useSettingsStore } from '@/stores/settingsStore';

interface ActivityRingsProps {
  data: TripleRingsData;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLegend?: boolean;
}

/**
 * Concentric Triple Activity Rings (Practice, Focus, Mastery)
 * Pure SVG with smooth gradient strokes, responsive scaling, and glow.
 */
export function ActivityRings({
  data,
  size = 110,
  strokeWidth = 9,
  className = '',
  showLegend = true,
}: ActivityRingsProps) {
  const { theme } = useSettingsStore();
  const isOnePiece = theme === 'onepiece';

  const center = size / 2;
  const gap = strokeWidth + 2.5;

  // Concentric Radii (Outer to Inner)
  const rPractice = center - strokeWidth;
  const rFocus = rPractice - gap;
  const rMastery = rFocus - gap;

  const circPractice = 2 * Math.PI * rPractice;
  const circFocus = 2 * Math.PI * rFocus;
  const circMastery = 2 * Math.PI * rMastery;

  // Ring Percentages (Clamped for strokeDashoffset, but tracks actual)
  const offsetPractice = circPractice - (Math.min(100, data.practice.pct) / 100) * circPractice;
  const offsetFocus = circFocus - (Math.min(100, data.focus.pct) / 100) * circFocus;
  const offsetMastery = circMastery - (Math.min(100, data.mastery.pct) / 100) * circMastery;

  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      {/* SVG Concentric Rings */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          <defs>
            {/* Practice Ring Gradient (Outer - Coral/Pink/Red) */}
            <linearGradient id="grad-practice" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isOnePiece ? '#FF334B' : '#FA2D55'} />
              <stop offset="100%" stopColor={isOnePiece ? '#FF7A00' : '#FF5B00'} />
            </linearGradient>

            {/* Focus Ring Gradient (Middle - Neon Green/Emerald) */}
            <linearGradient id="grad-focus" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isOnePiece ? '#00F5D4' : '#30D158'} />
              <stop offset="100%" stopColor={isOnePiece ? '#00BBF9' : '#34C759'} />
            </linearGradient>

            {/* Mastery Ring Gradient (Inner - Cyan/Electric Blue) */}
            <linearGradient id="grad-mastery" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isOnePiece ? '#FFD600' : '#00C7BE'} />
              <stop offset="100%" stopColor={isOnePiece ? '#FF8F00' : '#0A84FF'} />
            </linearGradient>

            {/* Filter Glow */}
            <filter id="ring-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Track Circles */}
          <circle cx={center} cy={center} r={rPractice} fill="none" stroke="rgba(255, 45, 85, 0.15)" strokeWidth={strokeWidth} />
          <circle cx={center} cy={center} r={rFocus} fill="none" stroke="rgba(48, 209, 88, 0.15)" strokeWidth={strokeWidth} />
          <circle cx={center} cy={center} r={rMastery} fill="none" stroke="rgba(0, 199, 190, 0.15)" strokeWidth={strokeWidth} />

          {/* Practice Ring Active */}
          <motion.circle
            cx={center}
            cy={center}
            r={rPractice}
            fill="none"
            stroke="url(#grad-practice)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circPractice}
            initial={{ strokeDashoffset: circPractice }}
            animate={{ strokeDashoffset: offsetPractice }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            filter={data.practice.pct >= 100 ? 'url(#ring-glow)' : undefined}
          />

          {/* Focus Ring Active */}
          <motion.circle
            cx={center}
            cy={center}
            r={rFocus}
            fill="none"
            stroke="url(#grad-focus)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circFocus}
            initial={{ strokeDashoffset: circFocus }}
            animate={{ strokeDashoffset: offsetFocus }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            filter={data.focus.pct >= 100 ? 'url(#ring-glow)' : undefined}
          />

          {/* Mastery Ring Active */}
          <motion.circle
            cx={center}
            cy={center}
            r={rMastery}
            fill="none"
            stroke="url(#grad-mastery)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circMastery}
            initial={{ strokeDashoffset: circMastery }}
            animate={{ strokeDashoffset: offsetMastery }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            filter={data.mastery.pct >= 100 ? 'url(#ring-glow)' : undefined}
          />
        </svg>

        {/* Center icon or closed badge */}
        {data.closedAll && (
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            className="absolute inset-0 m-auto w-7 h-7 rounded-full bg-gradient-to-tr from-[#FFB703] to-[#FF334B] grid place-items-center shadow-lg text-black font-black text-xs pointer-events-none"
          >
            <Sparkles size={14} className="text-white" />
          </motion.div>
        )}
      </div>

      {/* Legend & Numbers */}
      {showLegend && (
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          {/* Practice Row */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-bold text-text truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FA2D55] shrink-0" />
              Practice
            </span>
            <span className="tabular-nums font-semibold text-text-2 text-[11px]">
              {data.practice.current}/{data.practice.target} Qs
            </span>
          </div>

          {/* Focus Row */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-bold text-text truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-[#30D158] shrink-0" />
              Study
            </span>
            <span className="tabular-nums font-semibold text-text-2 text-[11px]">
              {data.focus.current}/{data.focus.target} min
            </span>
          </div>

          {/* Mastery Row */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-bold text-text truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00C7BE] shrink-0" />
              Accuracy
            </span>
            <span className="tabular-nums font-semibold text-text-2 text-[11px]">
              {data.mastery.current}% ({data.mastery.target}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
