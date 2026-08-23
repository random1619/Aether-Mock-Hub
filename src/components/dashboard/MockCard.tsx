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
    muted metadata, a blue pill CTA and an iOS-style completion check.
    MOBILE PRECISION: on phones the grid card becomes a horizontal row —
    72px icon left, full title right, with mock number + provider dot
    so every card is instantly scannable even when titles share a prefix. */
export function MockCard({ mock, done, score, onToggle, onOpenModal, variant = 'grid', rank }: MockCardProps) {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';
  const isOnePiece = theme === 'onepiece';
  const rail = variant === 'rail';
  const [origin, setOrigin] = useState('center center');

  // ——— Distinct identity for small screens ———
  // Extract trailing number (e.g. "Mock 06" or path "_9872") so truncated
  // titles like "SSC CGL 2025 Pre Eduquity..." still show "06" distinctly.
  const mockNumber = (() => {
    const m1 = mock.name.match(/(\d{1,4})\s*$/);
    if (m1) return m1[1].padStart(2, '0').slice(-2);
    const m2 = mock.path.match(/_(\d+)\.html$/);
    if (m2) return m2[1].slice(-2);
    return '';
  })();
  const providerDot: Record<string, string> = {
    Pundits: '#bf5af2',
    Oliveboard: '#0071e3',
    'English Madhyam': '#30d158',
    'The Solver': '#ff9f0a',
    '360 Mocks': '#ff375f',
    'Static GK': '#5e5ce6',
  };
  const dotColor = providerDot[mock.provider] ?? 'var(--border-strong)';

  const sub = score
    ? `Best ${score.score.toFixed(0)}/${score.maxScore.toFixed(0)} · ${score.accuracy}%`
    : mockNumber
      ? `${mock.provider} • #${mockNumber}${mock.subject && mock.subject !== 'General' ? ` • ${mock.subject}` : ''}`
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

  // Apple: respond on pointer-down, not hover-only. Track grab offset implicitly
  // via 1:1 motion; use pointer events so touch + drag keep the interaction glued.
  const card = (
    <motion.div
      onMouseEnter={handleMouseEnter}
      whileHover={isNetflix ? undefined : { y: -4, scale: 1.015 }}
      whileTap={isNetflix ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      style={{ transformOrigin: isNetflix ? origin : '50% 38%' } as any}
      className={clsx(
        // MOBILE: grid cards become horizontal rows (72px art + text) so titles are scannable
        'mockcard group flex card-elevated-hover relative focus-within:z-[60] will-change-transform',
        !rail && !isNetflix && 'flex-row sm:flex-col gap-3 sm:gap-2.5 p-3 sm:p-4 rounded-2xl bg-surface ring-1 ring-[var(--glass-border)] overflow-hidden h-full Apple-press items-center sm:items-stretch',
        rail && !isNetflix && 'flex-col gap-2.5 sm:gap-3 snap-start shrink-0 w-[142px] xs:w-40 sm:w-52 p-3 sm:p-3.5 rounded-2xl bg-surface ring-1 ring-[var(--glass-border)] overflow-hidden',
        isNetflix && 'flex-col gap-2.5 sm:gap-3 rounded-2xl bg-transparent overflow-visible p-0',
        rail && isNetflix && 'snap-start shrink-0 w-[142px] xs:w-40 sm:w-52',
      )}
    >
      <div className={clsx('relative overflow-hidden shrink-0', !rail && !isNetflix ? 'w-[72px] h-[72px] sm:w-full sm:h-auto rounded-xl sm:rounded-lg' : 'rounded-2xl w-full')}>
        {/* Provider dot — mobile only, for instant brand scan */}
        {!isNetflix && !rail && (
          <span
            aria-hidden
            className="sm:hidden absolute top-1 right-1 w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm"
            style={{ background: dotColor }}
          />
        )}
        <Link to={examPath(mock.path)} aria-label={`Start ${mock.name}`} className="block">
          <CoverArt
            seed={mock.path}
            title={mock.name}
            className={clsx('mockcard-art w-full', isNetflix ? 'aspect-video rounded-2xl' : 'aspect-square', rail ? 'text-2xl' : 'text-3xl')}
          />
        </Link>

        {/* Completion Check Badge Overlay for default and One Piece theme */}
        {isOnePiece && done ? (
          <div className="absolute top-2 right-2 z-10">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#FFB703] to-[#FF8F00] text-black text-[10px] font-black shadow-md">
              <span>👑</span> Conquered
            </span>
          </div>
        ) : !isNetflix && done ? (
          <div className="absolute top-2 right-2 z-10">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success text-white text-[11px] font-bold shadow-md backdrop-blur-md">
              <Check size={11} strokeWidth={3} />
              Done
            </span>
          </div>
        ) : null}

        {/* Score Badge Overlay if score exists */}
        {isOnePiece && !done && score ? (
          <div className="absolute top-2 right-2 z-10">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0D1524]/90 border border-[#FFB703]/40 text-[#FFB703] text-[10px] font-bold shadow-md">
              <Award size={10} className="text-[#FFB703]" />
              {score.score.toFixed(0)}m · {score.accuracy}%
            </span>
          </div>
        ) : !isNetflix && !done && score ? (
          <div className="absolute top-2 right-2 z-10">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-white text-[11px] font-bold shadow-md backdrop-blur-md">
              <Award size={11} />
              {score.accuracy}%
            </span>
          </div>
        ) : null}

        {/* One Piece Grand Line Corner Badge */}
        {isOnePiece && (
          <div className="absolute top-1.5 left-1.5 z-10 pointer-events-none">
            <span className="bg-[#070B14]/85 border border-[#FFB703]/30 text-[#FFB703] text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider shadow backdrop-blur-sm">
              ☠️ GL
            </span>
          </div>
        )}

        {/* One Piece Amber/Crimson Progress Bar for attempted/completed mocks */}
        {isOnePiece && (done || score) && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1E293B] z-10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FFB703] to-[#FF334B] transition-all duration-300"
              style={{ width: done ? '100%' : `${score?.accuracy ?? 40}%` }}
            />
          </div>
        )}
        
        {/* Netflix Red Progress Bar for attempted/completed mocks */}
        {isNetflix && (done || score) && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60 z-10 overflow-hidden rounded-b-2xl">
            <div
              className="h-full bg-[#E50914] shadow-[0_0_8px_#E50914] transition-all duration-300"
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
          <div className="absolute top-2 left-2 z-10 pointer-events-none">
            <span className="bg-[#E50914] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-md">
              N
            </span>
          </div>
        )}

      </div>

      {/* Netflix Expanded Metadata Panel (Only visible on hover).
          Uses the .mockcard-drawer class from theme.css with Apple frosted glass */}
      {isNetflix && (
        <div className="mockcard-drawer flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                to={examPath(mock.path)}
                className="drawer-action w-9 h-9 !rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-90 shadow-md transition-all"
                title="Start Mock"
                aria-label={`Start ${mock.name}`}
              >
                <Play size={16} fill="currentColor" className="ml-0.5" />
              </Link>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                title={done ? 'Mark incomplete' : 'Mark completed'}
                aria-label={done ? `Mark ${mock.name} incomplete` : `Mark ${mock.name} completed`}
                aria-pressed={done}
                className={clsx(
                  'drawer-action w-9 h-9 !rounded-full border backdrop-blur-md transition-all',
                  done
                    ? 'bg-[#46d369] text-black border-transparent shadow-[0_2px_10px_rgba(70,211,105,0.4)]'
                    : 'border-white/30 bg-white/10 text-white hover:border-white hover:bg-white/20',
                )}
              >
                {done ? <Check size={16} strokeWidth={3} /> : <span className="text-xl leading-none mb-0.5">+</span>}
              </motion.button>
            </div>
            {onOpenModal && (
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={(e) => { e.stopPropagation(); onOpenModal(mock); }}
                title="More info"
                aria-label={`More information about ${mock.name}`}
                className="drawer-action w-9 h-9 !rounded-full border border-white/30 bg-white/10 text-white hover:border-white hover:bg-white/20 backdrop-blur-md transition-all"
              >
                <Info size={16} />
              </motion.button>
            )}
          </div>

          {/* Match % row — Apple pill badges */}
          <div className="flex items-center gap-2 text-[11px] font-bold">
            {score && (
              <span className="text-[#46d369] bg-[#46d369]/15 px-2 py-0.5 rounded-full">{score.accuracy}% Match</span>
            )}
            <span className="border border-white/30 bg-white/10 text-white/90 px-2 py-0.5 rounded-full text-[10px] leading-tight">
              {done ? 'Completed' : 'Mock Test'}
            </span>
            {score && (
              <span className="text-white/70 font-semibold">
                Best {score.score.toFixed(0)}/{score.maxScore.toFixed(0)}
              </span>
            )}
          </div>

          {/* Progress indicator */}
          {(done || score) && (
            <div
              className="h-1 w-full rounded-full bg-white/10 overflow-hidden"
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
        <div className={clsx(rail ? 'flex flex-col flex-1 min-w-0 gap-1' : 'flex-1 min-w-0 flex flex-col justify-between gap-2 py-0.5 sm:gap-1 sm:py-0')}>
          <div className="min-w-0">
            <Link to={examPath(mock.path)} className="block">
              <h3
                className={clsx(
                  'font-semibold tracking-[-0.01em] leading-snug text-text group-hover:text-primary transition-colors',
                  rail ? 'line-clamp-2 min-h-[2.6em] text-sm' : 'line-clamp-2 sm:line-clamp-2 text-[14px] sm:text-[15px] leading-[1.35] sm:leading-snug sm:min-h-[2.6em]',
                )}
              >
                {/* Mobile: show number prefix for instant scan if not already in sub */}
                <span className="sm:hidden inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface-2 text-[11px] font-black mr-1.5 align-middle -mt-0.5" aria-hidden>
                  {mockNumber || '•'}
                </span>
                {mock.name}
              </h3>
            </Link>
            <p className={clsx('flex items-center gap-1.5 mt-1 font-medium truncate', rail ? 'text-xs text-muted' : 'text-[12px] sm:text-[13px] text-muted')}>
              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} aria-hidden />
              <span className="truncate">{sub}</span>
            </p>
          </div>

          <div className={clsx('flex items-center', rail ? 'justify-between gap-2 pt-0.5' : 'justify-between gap-2 sm:gap-3 pt-0.5 sm:pt-1')}>
            <motion.button
              whileTap={{ scale: 0.82 }}
              onClick={onToggle}
              aria-pressed={done}
              aria-label={done ? 'Mark as not completed' : 'Mark as completed'}
              title={done ? 'Completed' : 'Mark complete'}
              className={clsx(
                'grid place-items-center rounded-full transition-colors shrink-0 active:scale-95 border',
                rail ? 'w-9 h-9 sm:w-7 sm:h-7' : 'w-9 h-9 sm:w-8 sm:h-8',
                done
                  ? 'bg-success text-white shadow-sm border-transparent'
                  : 'bg-surface-2 text-muted border-transparent hover:text-primary hover:bg-primary-soft',
              )}
            >
              <Check size={rail ? 14 : 15} strokeWidth={3} className="sm:w-[13px] sm:h-[13px]" />
            </motion.button>
            <Link
              to={done || score ? examPath(mock.path, { mode: 'review' }) : examPath(mock.path)}
              className={clsx(
                'inline-flex items-center justify-center rounded-full font-bold active:scale-95 transition-all shadow-sm',
                isOnePiece
                  ? 'bg-gradient-to-r from-[#FFB703] to-[#FF8F00] text-black hover:brightness-110 shadow-[0_2px_10px_rgba(255,183,3,0.25)]'
                  : done || score
                    ? 'bg-answered text-white hover:brightness-110'
                    : 'bg-primary text-white hover:bg-primary-hover',
                rail ? 'px-4 py-2 text-sm sm:px-3.5 sm:py-1 sm:text-xs min-h-[36px] sm:min-h-0' : 'flex-1 sm:flex-none px-4 py-2 text-sm sm:px-4 sm:py-1.5 sm:text-[13px] min-h-[38px] sm:min-h-0 gap-1.5',
              )}
            >
              {isOnePiece ? (done || score ? 'Review' : 'Battle') : (done || score ? 'Review' : 'Start')} <span className="hidden sm:inline">→</span><span className="sm:hidden">›</span>
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );

  return rail ? card : <Reveal className="h-full">{card}</Reveal>;
}
