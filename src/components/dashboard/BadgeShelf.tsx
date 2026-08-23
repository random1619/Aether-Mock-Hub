import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Trophy, ShieldCheck } from 'lucide-react';
import { BadgeCard } from './BadgeCard';
import { evaluateAllBadges, calculateAspirantLevel, BADGE_DEFINITIONS } from '@/services/gamificationService';
import { getDb } from '@/services/attemptStore';
import { useGamificationStore } from '@/stores/gamificationStore';
import { useSettingsStore } from '@/stores/settingsStore';

export function BadgeShelf() {
  const db = getDb();
  const { selectedBadge, setSelectedBadge } = useGamificationStore();
  const { theme } = useSettingsStore();
  const isOnePiece = theme === 'onepiece';
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const { unlocked, inProgress, totalXp } = useMemo(() => evaluateAllBadges(db), [db]);
  const levelInfo = useMemo(() => calculateAspirantLevel(totalXp), [totalXp]);

  const allBadges = useMemo(() => {
    const combined = [...unlocked.map((b) => ({ ...b, isUnlocked: true })), ...inProgress.map((b) => ({ ...b, isUnlocked: false }))];
    if (filter === 'unlocked') return combined.filter((b) => b.isUnlocked);
    if (filter === 'locked') return combined.filter((b) => !b.isUnlocked);
    return combined;
  }, [unlocked, inProgress, filter]);

  return (
    <div className="rounded-3xl bg-surface ring-1 ring-[var(--glass-border)] p-5 sm:p-7 space-y-6">
      {/* Level & XP Progression Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FFB703] to-[#FF334B] text-black font-black grid place-items-center text-xl shadow-lg shrink-0">
            {isOnePiece ? '☠️' : <Trophy size={24} className="text-white" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-primary text-white shadow-xs">
                LEVEL {levelInfo.level}
              </span>
              <span className="text-xs font-bold text-muted uppercase tracking-wider">
                {isOnePiece ? levelInfo.onePieceRankTitle : levelInfo.rankTitle}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-text mt-0.5 truncate">
              Aspirant Mastery &amp; Badges
            </h3>
          </div>
        </div>

        {/* XP Bar & Stats */}
        <div className="flex flex-col gap-1.5 md:w-64">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-muted flex items-center gap-1">
              <Sparkles size={12} className="text-[#FFB703]" /> Total XP
            </span>
            <span className="text-text tabular-nums">{levelInfo.xp} XP</span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-3 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#FFB703] via-[#FF5B00] to-[#FA2D55]"
              initial={{ width: 0 }}
              animate={{ width: `${levelInfo.progressPct}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <div className="text-[10px] text-muted text-right">
            {levelInfo.xpForNextLevel - levelInfo.xp} XP to Level {levelInfo.level + 1}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Counter */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-full text-xs font-semibold">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full transition-all ${filter === 'all' ? 'bg-bg-raised text-text shadow-sm' : 'text-muted hover:text-text'}`}
          >
            All ({allBadges.length})
          </button>
          <button
            onClick={() => setFilter('unlocked')}
            className={`px-3 py-1 rounded-full transition-all ${filter === 'unlocked' ? 'bg-bg-raised text-success shadow-sm' : 'text-muted hover:text-text'}`}
          >
            Unlocked ({unlocked.length})
          </button>
          <button
            onClick={() => setFilter('locked')}
            className={`px-3 py-1 rounded-full transition-all ${filter === 'locked' ? 'bg-bg-raised text-text shadow-sm' : 'text-muted hover:text-text'}`}
          >
            In Progress ({inProgress.length})
          </button>
        </div>

        <div className="text-xs font-bold text-muted hidden sm:block">
          {unlocked.length} of {BADGE_DEFINITIONS.length} Badges Claimed
        </div>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {allBadges.map((b) => (
          <BadgeCard
            key={b.id}
            badge={b}
            isUnlocked={b.isUnlocked}
            onClick={() => setSelectedBadge(b)}
          />
        ))}
      </div>

      {/* Badge Inspection Modal */}
      <AnimatePresence>
        {selectedBadge && (
          <div className="fixed inset-0 z-[9999] grid place-items-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-surface border border-[var(--glass-border)] p-6 shadow-2xl relative text-left"
            >
              <button
                onClick={() => setSelectedBadge(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-2 grid place-items-center text-muted hover:text-text hover:bg-surface-3 transition-all"
                aria-label="Close"
              >
                <X size={16} />
              </button>

              <div className="flex flex-col items-center text-center gap-3 pt-2">
                <div className="w-16 h-16 rounded-2xl bg-surface-2 ring-2 ring-primary/40 grid place-items-center text-4xl shadow-md">
                  {selectedBadge.icon}
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary">
                    {selectedBadge.tier} TIER
                  </span>
                  <h3 className="text-xl font-black text-text mt-2">
                    {selectedBadge.title}
                  </h3>
                  <p className="text-xs text-muted mt-1 leading-relaxed max-w-xs">
                    {selectedBadge.description}
                  </p>
                </div>

                <div className="w-full bg-surface-2 rounded-2xl p-4 mt-2 border border-border flex items-center justify-around text-center">
                  <div>
                    <div className="text-xs text-muted font-bold">Status</div>
                    <div className="text-sm font-black text-text mt-0.5 flex items-center gap-1 justify-center">
                      <ShieldCheck size={14} className="text-success" />
                      {selectedBadge.progress >= selectedBadge.maxProgress ? 'Unlocked' : 'In Progress'}
                    </div>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div>
                    <div className="text-xs text-muted font-bold">Requirement</div>
                    <div className="text-sm font-bold text-text mt-0.5">
                      {selectedBadge.detail || `${selectedBadge.progress}/${selectedBadge.maxProgress}`}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedBadge(null)}
                  className="w-full mt-4 py-2.5 rounded-full bg-primary hover:bg-primary-hover text-white font-bold text-sm transition-all shadow-md active:scale-95"
                >
                  Awesome
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
