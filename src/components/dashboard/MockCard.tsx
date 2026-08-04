import { Link } from 'react-router-dom';
import { Check, Play, Info, Award } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Reveal } from '@/components/ui';
import { CoverArt } from './CoverArt';
import { examPath } from '@/lib/examLink';
import type { MockEntry } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { useState } from 'react';

interface MockCardProps {
  mock: MockEntry;
  done: boolean;
  score?: { score: number; maxScore: number; accuracy: number };
  onToggle: () => void;
  onOpenModal?: (mock: MockEntry) => void;
  /** 'grid' fills its grid cell with scroll-reveal; 'rail' is a fixed-width
      snap tile for horizontal shelves. Same tile, two sizes. */
  variant?: 'grid' | 'rail';
  /** Top 10 ranking number (1-10) for Netflix theme */
  rank?: number;
}

/** App Store–style tile: app-icon artwork on a soft gray field, tight title,
    muted metadata, a blue pill CTA and an iOS-style completion check. */
export function MockCard({ mock, done, score, onToggle, onOpenModal, variant = 'grid', rank }: MockCardProps) {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';
  const rail = variant === 'rail';
  const [origin, setOrigin] = useState('center center');
  const sub = score
    ? `Best ${score.score.toFixed(0)}/${score.maxScore.toFixed(0)} · ${score.accuracy}%`
    : mock.subject && mock.subject !== 'General'
      ? `${mock.provider} · ${mock.subject}`
      : mock.provider;

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isNetflix) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const vw = window.innerWidth;
    const threshold = 60; // Distance from edge to trigger alignment
    if (rect.left < threshold) {
      setOrigin('left center');
    } else if (rect.right > vw - threshold) {
      setOrigin('right center');
    } else {
      setOrigin('center center');
    }
  };

  const card = (
    <motion.div
      onMouseEnter={handleMouseEnter}
      whileHover={isNetflix ? undefined : { y: -6, scale: 1.02 }}
      whileTap={isNetflix ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      style={{ transformOrigin: isNetflix ? origin : undefined }}
      className={clsx(
        'mockcard group flex flex-col gap-3 transition-all duration-300 card-elevated-hover relative focus-within:z-[60]',
        !isNetflix && 'rounded-2xl bg-surface ring-1 ring-[var(--glass-border)] overflow-hidden h-full p-4',
        isNetflix && 'rounded-[4px] bg-transparent overflow-visible p-0',
        rail && !isNetflix && 'snap-start shrink-0 w-44 sm:w-52 p-3.5',
        rail && isNetflix && 'snap-start shrink-0 w-44 sm:w-52',
      )}
    >
      <div className="relative overflow-hidden rounded-[4px]">
        <Link to={examPath(mock.path)} aria-label={`Start ${mock.name}`} className="block">
          <CoverArt
            seed={mock.path}
            title={mock.name}
            className={clsx('mockcard-art w-full', isNetflix ? 'aspect-video' : 'aspect-square', rail ? 'text-2xl' : 'text-3xl')}
          />
        </Link>

        {/* Completion Check Badge Overlay for default theme */}
        {!isNetflix && done && (
          <div className="absolute top-2 right-2 z-10">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success text-white text-[11px] font-bold shadow-md backdrop-blur-md">
              <Check size={11} strokeWidth={3} />
              Done
            </span>
          </div>
        )}

        {/* Score Badge Overlay if score exists */}
        {!isNetflix && !done && score && (
          <div className="absolute top-2 right-2 z-10">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-white text-[11px] font-bold shadow-md backdrop-blur-md">
              <Award size={11} />
              {score.accuracy}%
            </span>
          </div>
        )}
        
        {/* Netflix Red Progress Bar for attempted/completed mocks */}
        {isNetflix && (done || score) && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#404040] z-10 overflow-hidden">
            <div
              className="h-full bg-[#E50914] transition-all duration-300"
              style={{ width: done ? '100%' : `${score?.accuracy ?? 40}%` }}
            />
          </div>
        )}

        {/* Top 10 Rank Number */}
        {isNetflix && rank !== undefined && rank <= 10 && (
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <span className="top10-rank text-7xl">{rank}</span>
          </div>
        )}

        {/* Netflix N Badge Overlay Tag */}
        {isNetflix && (
          <div className="absolute top-1.5 left-1.5 z-10 pointer-events-none">
            <span className="bg-[#E50914] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-[1.5px] uppercase tracking-wider shadow">
              N
            </span>
          </div>
        )}


      </div>

      {/* Netflix Expanded Metadata Panel (Only visible on hover).
          Uses the .mockcard-drawer class from theme.css so the panel
          slides out with the signature ease-out transform transition. */}
      {isNetflix && (
        <div className="mockcard-drawer flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                to={examPath(mock.path)}
                className="drawer-action w-8 h-8 !rounded-full bg-white text-black hover:bg-white/80 shadow-md"
                title="Start Mock"
                aria-label={`Start ${mock.name}`}
              >
                <Play size={15} fill="currentColor" className="ml-0.5" />
              </Link>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                title={done ? 'Mark incomplete' : 'Mark completed'}
                aria-label={done ? `Mark ${mock.name} incomplete` : `Mark ${mock.name} completed`}
                aria-pressed={done}
                className={clsx(
                  'drawer-action w-8 h-8 !rounded-full border',
                  done
                    ? 'bg-[#46d369] text-black border-transparent shadow-md'
                    : 'border-white/40 text-white hover:border-white hover:bg-white/10',
                )}
              >
                {done ? <Check size={15} strokeWidth={3} /> : <span className="text-xl leading-none mb-0.5">+</span>}
              </motion.button>
            </div>
            {onOpenModal && (
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={(e) => { e.stopPropagation(); onOpenModal(mock); }}
                title="More info"
                aria-label={`More information about ${mock.name}`}
                className="drawer-action w-8 h-8 !rounded-full border border-white/40 text-white hover:border-white hover:bg-white/10"
              >
                <Info size={15} />
              </motion.button>
            )}
          </div>

          {/* Match % row — Netflix's "98% Match" green plus maturity chip */}
          <div className="flex items-center gap-2 text-[11px] font-bold">
            {score && (
              <span className="text-[#46d369]">{score.accuracy}% Match</span>
            )}
            <span className="border border-white/40 text-white/90 px-1 py-px rounded-[2px] text-[9px] leading-tight">
              {done ? 'Completed' : 'Mock test'}
            </span>
            {score && (
              <span className="text-white/70 font-semibold">
                Best {score.score.toFixed(0)}/{score.maxScore.toFixed(0)}
              </span>
            )}
          </div>

          {/* Progress indicator — thin red bar mirroring the cover overlay */}
          {(done || score) && (
            <div
              className="h-[3px] w-full rounded-full bg-[#404040] overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={done ? 100 : (score?.accuracy ?? 0)}
              aria-label={`Progress on ${mock.name}`}
            >
              <div
                className="h-full bg-[#E50914]"
                style={{ width: done ? '100%' : `${score?.accuracy ?? 40}%` }}
              />
            </div>
          )}

          {/* Genre breadcrumb — subject · category */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/80 font-semibold line-clamp-1">
            <span>{mock.subject || 'General'}</span>
            <span aria-hidden className="w-1 h-1 rounded-full bg-white/40" />
            <span>{mock.category || 'Mock Test'}</span>
          </div>
        </div>
      )}

      {!isNetflix && (
        <>
          <div className="flex-1 min-w-0">
            <Link to={examPath(mock.path)} className="block">
              <h3
                className={clsx(
                  'font-semibold tracking-[-0.01em] leading-snug line-clamp-2 min-h-[2.6em] text-text group-hover:text-primary transition-colors',
                  rail ? 'text-sm' : 'text-[15px]',
                )}
              >
                {mock.name}
              </h3>
            </Link>
            <p className={clsx('text-muted truncate mt-0.5 font-medium', rail ? 'text-xs' : 'text-[13px]')}>{sub}</p>
          </div>

          <div className={clsx('flex items-center justify-between', rail ? 'gap-2 pt-0.5' : 'gap-3 pt-1')}>
            <motion.button
              whileTap={{ scale: 0.82 }}
              onClick={onToggle}
              aria-pressed={done}
              aria-label={done ? 'Mark as not completed' : 'Mark as completed'}
              title={done ? 'Completed' : 'Mark complete'}
              className={clsx(
                'grid place-items-center rounded-full transition-colors',
                rail ? 'w-7 h-7' : 'w-8 h-8',
                done
                  ? 'bg-success text-white shadow-sm'
                  : 'bg-surface-2 text-muted hover:text-primary hover:bg-primary-soft',
              )}
            >
              <Check size={rail ? 13 : 15} strokeWidth={3} />
            </motion.button>
            <Link
              to={examPath(mock.path)}
              className={clsx(
                'inline-flex items-center rounded-full bg-primary text-white font-semibold hover:bg-primary-hover active:scale-95 transition-all shadow-sm',
                rail ? 'px-3.5 py-1 text-xs' : 'px-4 py-1.5 text-[13px]',
              )}
            >
              Start
            </Link>
          </div>
        </>
      )}
    </motion.div>
  );

  return rail ? card : <Reveal className="h-full">{card}</Reveal>;
}
