import { useMemo } from 'react';
import { Play, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Rail } from './Rail';
import { CoverArt } from './CoverArt';
import { examPath } from '@/lib/examLink';
import type { MockEntry, Attempt } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';

export interface ContinueWatchItem {
  mock: MockEntry;
  /** The in-progress attempt */
  attempt: Attempt;
  /** Questions answered so far */
  answered: number;
  /** Total questions in the exam */
  total: number;
}

/** "Continue Watching" rail - Netflix style showing exams in progress */
export function ContinueWatchingRail({ items }: { items: ContinueWatchItem[] }) {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';

  // Filter to only show items with some progress but not completed
  const inProgress = useMemo(
    () => items.filter(item => item.answered > 0 && item.answered < item.total),
    [items]
  );

  if (inProgress.length === 0) return null;

  return (
    <Rail
      title={
        isNetflix ? (
          <span className="flex items-center gap-2.5 text-white">
            <span className="w-1.5 h-6 bg-[#E50914] rounded-full inline-block shadow-[0_0_12px_#E50914]" />
            Continue Watching
          </span>
        ) : (
          "Continue where you left off"
        )
      }
      hint={isNetflix ? "Pick up where you stopped" : "Resume your in-progress exams"}
      icon={!isNetflix ? <Clock size={20} /> : undefined}
    >
      {inProgress.map(({ mock, answered, total }) => {
        const progress = Math.round((answered / total) * 100);

        return (
          <div
            key={mock.path}
            className="snap-start shrink-0 w-64 sm:w-72 relative group cursor-pointer"
          >
            <Link to={examPath(mock.path)} className="block">
              <div className="relative rounded-2xl overflow-hidden ring-1 ring-[var(--glass-border)] shadow-md">
                <CoverArt
                  seed={mock.path}
                  title={mock.name}
                  className="w-full aspect-video text-xl"
                />

                {/* Progress bar overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60 overflow-hidden">
                  <motion.div
                    className="h-full bg-[#E50914] shadow-[0_0_8px_#E50914]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {/* Play button overlay on hover */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white text-black shadow-xl flex items-center justify-center group-hover:scale-110 active:scale-90 transition-transform">
                    <Play size={20} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>

                {/* Progress percentage badge */}
                <div className="absolute top-2.5 right-2.5 bg-[#E50914] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-md">
                  {progress}%
                </div>
              </div>

              <div className="mt-2.5 px-1">
                <h3 className="text-sm font-bold text-white group-hover:text-primary transition-colors line-clamp-1">
                  {mock.name}
                </h3>
                <p className="text-xs text-muted mt-0.5 font-medium">
                  {answered} of {total} questions answered
                </p>
              </div>
            </Link>
          </div>
        );
      })}
    </Rail>
  );
}