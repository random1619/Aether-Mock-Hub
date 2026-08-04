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
          <span className="border-l-4 border-[#E50914] pl-2.5 inline-block text-white">
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
              <div className="relative rounded-[4px] overflow-hidden">
                <CoverArt
                  seed={mock.path}
                  title={mock.name}
                  className="w-full aspect-video text-xl"
                />

                {/* Progress bar overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#404040]">
                  <motion.div
                    className="h-full bg-[#E50914]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {/* Play button overlay on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                    <Play size={28} fill="black" className="text-black ml-1" />
                  </div>
                </div>

                {/* Progress percentage badge */}
                <div className="absolute top-2 right-2 bg-[#E50914] text-white text-xs font-bold px-2 py-0.5 rounded">
                  {progress}%
                </div>
              </div>

              <div className="mt-2">
                <h3 className="text-sm font-semibold text-white line-clamp-1">
                  {mock.name}
                </h3>
                <p className="text-xs text-[#A3A3A3] mt-0.5">
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