import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Check, Lock } from 'lucide-react';
import type { UnlockedBadge } from '@/services/gamificationService';

interface BadgeCardProps {
  badge: UnlockedBadge;
  isUnlocked: boolean;
  onClick?: () => void;
}

const TIER_STYLES = {
  bronze: {
    border: 'border-[#CD7F32]/50 hover:border-[#CD7F32]',
    bg: 'from-[#CD7F32]/15 to-transparent',
    glow: 'shadow-[0_2px_12px_rgba(205,127,50,0.2)]',
    badgeText: 'text-[#E5A65E]',
    tag: 'BRONZE',
  },
  silver: {
    border: 'border-[#C0C0C0]/50 hover:border-[#E0E0E0]',
    bg: 'from-[#E0E0E0]/15 to-transparent',
    glow: 'shadow-[0_2px_12px_rgba(192,192,192,0.25)]',
    badgeText: 'text-[#E0E0E0]',
    tag: 'SILVER',
  },
  gold: {
    border: 'border-[#FFD700]/50 hover:border-[#FFD700]',
    bg: 'from-[#FFD700]/20 to-transparent',
    glow: 'shadow-[0_4px_16px_rgba(255,215,0,0.3)]',
    badgeText: 'text-[#FFD700]',
    tag: 'GOLD',
  },
  diamond: {
    border: 'border-[#00F5D4]/60 hover:border-[#00F5D4]',
    bg: 'from-[#00F5D4]/20 via-[#7B2CBF]/15 to-transparent',
    glow: 'shadow-[0_4px_20px_rgba(0,245,212,0.35)]',
    badgeText: 'text-[#00F5D4]',
    tag: 'DIAMOND',
  },
};

export function BadgeCard({ badge, isUnlocked, onClick }: BadgeCardProps) {
  const tierConfig = TIER_STYLES[badge.tier] || TIER_STYLES.bronze;
  const pct = badge.maxProgress > 0 ? Math.min(100, Math.round((badge.progress / badge.maxProgress) * 100)) : (isUnlocked ? 100 : 0);

  return (
    <motion.button
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
      className={clsx(
        'w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden backdrop-blur-md cursor-pointer',
        isUnlocked
          ? `bg-gradient-to-br ${tierConfig.bg} bg-surface ${tierConfig.border} ${tierConfig.glow}`
          : 'bg-surface/60 border-border/70 opacity-75 grayscale-[0.6] hover:opacity-100 hover:grayscale-0',
      )}
    >
      {/* Tier Corner Pill */}
      <div className="flex items-center justify-between w-full mb-2">
        <span
          className={clsx(
            'text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full border',
            isUnlocked
              ? `${tierConfig.badgeText} border-current/30 bg-current/10`
              : 'text-muted border-border bg-surface-2',
          )}
        >
          {tierConfig.tag}
        </span>
        {isUnlocked ? (
          <span className="w-5 h-5 rounded-full bg-success/20 text-success grid place-items-center">
            <Check size={11} strokeWidth={3} />
          </span>
        ) : (
          <span className="w-5 h-5 rounded-full bg-surface-3 text-muted grid place-items-center">
            <Lock size={10} />
          </span>
        )}
      </div>

      {/* Icon & Title */}
      <div className="flex items-center gap-2.5 my-1">
        <div className="text-2xl shrink-0 p-1.5 rounded-xl bg-surface-2/80 ring-1 ring-white/10 shadow-sm">
          {badge.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs sm:text-sm font-bold text-text truncate">
            {badge.title}
          </h4>
          <p className="text-[11px] text-muted line-clamp-1 mt-0.5">
            {badge.description}
          </p>
        </div>
      </div>

      {/* Progress Bar or Completion note */}
      <div className="mt-2 pt-2 border-t border-border/50">
        <div className="flex items-center justify-between text-[10px] text-muted mb-1 font-semibold">
          <span>{badge.detail || (isUnlocked ? 'Unlocked' : 'In Progress')}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
          <motion.div
            className={clsx('h-full rounded-full', isUnlocked ? 'bg-gradient-to-r from-[#FFB703] to-[#34C759]' : 'bg-primary/70')}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      </div>
    </motion.button>
  );
}
