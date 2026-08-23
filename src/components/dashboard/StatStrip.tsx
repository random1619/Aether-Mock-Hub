import { CheckCircle2, Flame, Target, Trophy } from 'lucide-react';
import { StatTile } from '@/components/layout';
import type { Stats } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';

interface StatStripProps {
  stats: Stats;
  progressPct: number;
  completedCount: number;
  /** Null while the catalog is still loading — hides the (n/n) sub-label. */
  total: number | null;
}

/** The four hero stats, each a shared StatTile (icon chip + animated numeral +
    muted label). Null best score renders an em-dash. */
export function StatStrip({ stats, progressPct, completedCount, total }: StatStripProps) {
  const { theme } = useSettingsStore();
  const isOnePiece = theme === 'onepiece';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      <StatTile
        icon={<Flame size={16} />}
        tone="warning"
        value={stats.streakDays}
        format="plain"
        label={isOnePiece ? 'Voyage Days' : 'Day Streak'}
      />
      <StatTile
        icon={<Target size={16} />}
        tone="success"
        value={stats.avgAccuracy}
        format="percent"
        label={isOnePiece ? 'Observation Haki' : 'Avg Accuracy'}
      />
      <StatTile
        icon={<Trophy size={16} />}
        tone="primary"
        value={stats.bestScore ? stats.bestScore.score : null}
        format="score"
        label={isOnePiece ? 'Peak Bounty' : 'Best Score'}
      />
      <StatTile
        icon={<CheckCircle2 size={16} />}
        tone="info"
        value={progressPct}
        format="percent"
        label={isOnePiece ? 'Islands Cleared' : 'Completed'}
        sub={total === null ? undefined : `${completedCount}/${total}`}
      />
    </div>
  );
}
