import { Maximize, Minimize, BookOpen, LogOut, Sun, Moon, Eye, Award, User, Hash, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useExamStore } from '@/stores/examStore';
import { fmtClock } from '@/lib/scoring';
import { clsx } from 'clsx';
import { useSettingsStore } from '@/stores/settingsStore';
import { FocusControls } from './FocusControls';

/** Pseudo-candidate — pure cosmetic, like the live TCS candidate panel. */
function useCandidate() {
  const meta = useExamStore((s) => s.meta);
  const seed = (meta?.path || 'exam').length + (meta?.name || '').length;
  const roll = `SSC${String(2500 + (seed % 7000)).padStart(7, '0')}`;
  const name = 'CANDIDATE NAME';
  return { name, roll };
}

/** Top strip exactly like TCS: brand block left, candidate card right. */
export function ExamHeader({
  onShowInstructions,
  onShowScorecard,
  onExit,
}: {
  onShowInstructions: () => void;
  onShowScorecard?: () => void;
  onExit?: () => void;
}) {
  const meta = useExamStore((s) => s.meta);
  const timeRemaining = useExamStore((s) => s.timeRemaining);
  const phase = useExamStore((s) => s.phase);
  const lang = useExamStore((s) => s.lang);
  const setLang = useExamStore((s) => s.setLang);
  const activeAttempt = useExamStore((s) => s.activeAttempt);
  const allAttempts = useExamStore((s) => s.allAttempts);
  const switchReviewAttempt = useExamStore((s) => s.switchReviewAttempt);
  const { name, roll } = useCandidate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { theme, toggleTheme } = useSettingsStore();
  const isNetflix = theme === 'netflix';
  const isOnePiece = theme === 'onepiece';

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  const sectionalTimerEnabled = useExamStore((s) => s.sectionalTimerEnabled);
  const sectionTimeRemaining = useExamStore((s) => s.sectionTimeRemaining);

  const warnSec = phase === 'active' && sectionalTimerEnabled && sectionTimeRemaining <= 180 && sectionTimeRemaining > 0;
  const warn = phase === 'active' && timeRemaining <= 300 && timeRemaining > 0;
  const netflixTimer = isNetflix && phase === 'active';

  return (
    <header
      className="relative z-sticky flex items-stretch bg-tcs-header/80 backdrop-blur-xl backdrop-saturate-[180%] border-b border-tcs-border/60 select-none shadow-[0_1px_0_rgba(0,0,0,0.04),0_1px_8px_rgba(0,0,0,0.04)]"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        minHeight: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
      } as any}
    >
      {/* Subtle top highlight for depth */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10" />
      {/* Left block — brand + exam title */}
      <div className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-5 py-2.5 min-w-0 flex-1">
        {/* Brand — refined squircle with inner highlight */}
        <div
          aria-hidden
          className="hidden sm:grid place-items-center w-9 h-9 shrink-0 font-black text-[13px] text-white shadow-[0_2px_8px_rgba(0,113,227,0.3),inset_0_1px_0_rgba(255,255,255,0.3)] ring-1 ring-black/5"
          style={{
            borderRadius: '22%',
            background: isOnePiece
              ? 'linear-gradient(135deg, #FFB703 0%, #FF334B 100%)'
              : 'linear-gradient(150deg,#47a5ff 0%,#0071e3 100%)',
          }}
        >
          {isOnePiece ? '☠️' : 'A'}
        </div>
        <div className="min-w-0">
          <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.14em] text-tcs-muted font-extrabold truncate">
            {meta?.provider || 'Staff Selection Commission'}
          </div>
          <h1 className="text-xs sm:text-[13px] font-bold tracking-[-0.01em] text-tcs-text truncate" title={meta?.name || 'Mock Test'}>
            {meta?.name || 'Mock Test'}
          </h1>
        </div>
      </div>

      {/* Right block — timer stays visible; secondary tools remain scrollable */}
      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 border-l border-tcs-border/60 flex-nowrap overflow-x-auto max-w-[58vw] sm:max-w-none scrollbar-none">
        {phase === 'active' && !isNetflix && (
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Sectional Timer — premium pill with inner dot */}
            {sectionalTimerEnabled && (
              <div
                role="timer"
                aria-live="off"
                aria-label={`Section Time left ${fmtClock(sectionTimeRemaining)}`}
                className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-1.5 rounded-full border font-mono text-xs sm:text-[13px] font-extrabold tabular-nums shrink-0 shadow-sm"
                style={{
                  background: warnSec ? 'var(--tcs-warn-bg)' : 'var(--tcs-panel)',
                  borderColor: warnSec ? 'var(--tcs-warn-border)' : 'var(--border-strong)',
                  color: warnSec ? 'var(--tcs-warn-text)' : 'var(--tcs-text)',
                  boxShadow: warnSec ? '0 0 0 2px rgba(229,9,20,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                <span className={clsx('w-1.5 h-1.5 rounded-full animate-pulse', warnSec ? 'bg-[#ff453a]' : 'bg-[#30d158]')} aria-hidden />
                <span className="hidden sm:inline text-[9px] font-sans uppercase tracking-widest font-extrabold opacity-60">Sec</span>
                {fmtClock(sectionTimeRemaining)}
              </div>
            )}

            {/* Total Exam Time — refined */}
            <div
              role="timer"
              aria-live="off"
              aria-label={`Total Time left ${fmtClock(timeRemaining)}`}
              className={clsx(
                'flex items-center gap-2 rounded-full border font-mono font-bold tabular-nums shrink-0 shadow-sm',
                sectionalTimerEnabled
                  ? 'px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs text-tcs-muted border-border bg-surface'
                  : 'px-3 sm:px-3.5 py-1.5 text-xs sm:text-[13px] text-tcs-text',
              )}
              style={
                !sectionalTimerEnabled
                  ? {
                      background: warn ? 'var(--tcs-warn-bg)' : 'var(--tcs-panel)',
                      borderColor: warn ? 'var(--tcs-warn-border)' : 'var(--border-strong)',
                      color: warn ? 'var(--tcs-warn-text)' : 'var(--tcs-text)',
                      boxShadow: warn ? '0 0 0 2px rgba(229,9,20,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
                    }
                  : undefined
              }
            >
              <span className="hidden sm:inline text-[9px] font-sans uppercase tracking-widest font-bold opacity-60">
                {sectionalTimerEnabled ? 'Total' : 'Time Left'}
              </span>
              {fmtClock(timeRemaining)}
            </div>
          </div>
        )}

        {/* Netflix Subtitle-style Timer */}
        {netflixTimer && (
          <div
            role="timer"
            aria-live="off"
            aria-label={`Time left ${fmtClock(sectionalTimerEnabled ? sectionTimeRemaining : timeRemaining)}`}
            className="flex items-center gap-1.5 px-2 py-1 rounded-sm font-mono text-xs font-bold tabular-nums bg-black/70 text-white border border-white/20 shrink-0"
          >
            <span className="text-[9px] uppercase tracking-wider text-white/70">
              {sectionalTimerEnabled ? 'Sec Time' : 'Time'}
            </span>
            <span className={clsx((warnSec || warn) && 'text-[#f40612]')}>
              {fmtClock(sectionalTimerEnabled ? sectionTimeRemaining : timeRemaining)}
            </span>
          </div>
        )}

        {/* Review Mode + Scorecard indicator when exam is submitted */}
        {phase === 'submitted' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-black bg-primary/15 text-primary border border-primary/30 shadow-xs">
              <Eye size={13} />
              <span>Review Mode</span>
            </span>

            {/* Attempt Switcher if multiple attempts exist */}
            {allAttempts.length > 1 && (
              <div className="flex items-center rounded-full border border-tcs-border bg-tcs-panel-2 px-1.5 py-0.5 text-xs font-bold text-tcs-text gap-1">
                <span className="hidden md:inline text-[10px] text-tcs-muted font-medium uppercase tracking-wider pl-1">
                  Attempt:
                </span>
                <select
                  value={activeAttempt?.attemptNumber ?? allAttempts[allAttempts.length - 1]?.attemptNumber}
                  onChange={(e) => switchReviewAttempt(Number(e.target.value))}
                  aria-label="Select attempt to review"
                  className="bg-transparent text-xs font-bold text-tcs-text outline-none cursor-pointer py-0.5 pr-1"
                >
                  {allAttempts.map((a) => (
                    <option key={a.attemptNumber} value={a.attemptNumber} className="bg-surface text-text">
                      #{a.attemptNumber} ({a.score.toFixed(1)}/{a.maxScore.toFixed(0)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {onShowScorecard && (
              <button
                type="button"
                onClick={onShowScorecard}
                aria-label="View scorecard summary"
                title="View detailed scorecard and analytics"
                className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-answered/15 text-answered border border-answered/30 hover:bg-answered/25 transition-colors cursor-pointer shrink-0"
              >
                <Award size={13} />
                <span className="hidden sm:inline">Scorecard</span>
              </button>
            )}
          </div>
        )}

        {/* View In pill — TCS keeps language toggle in the header */}
        {phase !== 'welcome' && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="hidden md:inline text-[10px] uppercase tracking-wider text-tcs-muted font-bold">
              View In
            </span>
            <div className="flex rounded-sm border border-tcs-border overflow-hidden">
              {(['both', 'en', 'hi'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  title={
                    l === 'both'
                      ? 'Show English + Hindi together (every word kept)'
                      : l === 'en'
                        ? 'Show English only'
                        : 'Show Hindi only'
                  }
                  className="px-1.5 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold transition-colors min-h-[36px] sm:min-h-0 flex items-center justify-center cursor-pointer"
                  style={{
                    background: lang === l ? 'var(--tcs-panel-2)' : 'transparent',
                    color: lang === l ? 'var(--tcs-text)' : 'var(--tcs-muted)',
                  }}
                >
                  {l === 'both' ? 'BOTH' : l === 'en' ? 'EN' : 'HI'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Deep Focus Audio & Concentration */}
        <FocusControls />

        {/* Theme Switcher — change light/dark mode during exam */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme during examination"
          title={`Switch theme (currently ${theme})`}
          className="inline-flex items-center justify-center gap-1.5 w-9 sm:w-auto px-2 sm:px-2.5 py-1.5 rounded-sm text-xs font-bold border border-tcs-border text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2 transition-colors cursor-pointer min-h-[36px] sm:min-h-0 shrink-0"
        >
          {theme === 'dark' || theme === 'netflix' ? (
            <Sun size={14} className="text-warning-fg" />
          ) : (
            <Moon size={14} className="text-primary" />
          )}
          <span className="hidden sm:inline capitalize">{theme}</span>
        </button>

        <button
          onClick={onShowInstructions}
          aria-label="Show instructions"
          title="Instructions"
          className="inline-flex items-center justify-center gap-1.5 w-9 sm:w-auto px-2 sm:px-2.5 py-1.5 rounded-sm text-xs font-bold border border-tcs-border text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2 transition-colors cursor-pointer min-h-[36px] sm:min-h-0 shrink-0"
        >
          <BookOpen size={14} />
          <span className="hidden sm:inline">Instructions</span>
        </button>

        {/* Disabled mid-exam while fullscreen: clicking it would exit fullscreen
            and record an integrity violation against the user (self-trap). */}
        <button
          onClick={toggleFullscreen}
          disabled={phase === 'active' && isFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={
            phase === 'active' && isFullscreen
              ? 'Fullscreen is locked during the exam'
              : isFullscreen
                ? 'Exit fullscreen'
                : 'Enter fullscreen'
          }
          className="inline-grid place-items-center w-9 sm:w-7 h-9 sm:h-7 rounded-sm border border-tcs-border text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none shrink-0"
        >
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>

        {onExit ? (
          <button
            onClick={onExit}
            aria-label="Exit examination"
            title="Exit examination and return to dashboard"
            className="inline-flex items-center justify-center gap-1 w-9 sm:w-auto px-2 sm:px-2.5 py-1.5 rounded-sm text-xs font-bold border border-tcs-border text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2 transition-colors cursor-pointer min-h-[36px] sm:min-h-0 shrink-0"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Exit</span>
          </button>
        ) : (
          <Link
            to="/"
            aria-label="Exit examination"
            title="Exit examination and return to dashboard"
            className="inline-flex items-center justify-center gap-1 w-9 sm:w-auto px-2 sm:px-2.5 py-1.5 rounded-sm text-xs font-bold border border-tcs-border text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2 transition-colors min-h-[36px] sm:min-h-0 shrink-0"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Exit</span>
          </Link>
        )}

        {/* Candidate card */}
        <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-tcs-border shrink-0">
          <div
            aria-hidden
            className="grid place-items-center w-9 h-10 rounded-sm bg-tcs-panel-2 border border-tcs-border text-tcs-muted"
            title="Candidate photo"
          >
            <User size={18} />
          </div>
          <div className="hidden lg:block leading-tight">
            <div className="text-[11px] font-bold text-tcs-text uppercase tracking-wide flex items-center gap-1">
              <User size={10} className="text-tcs-muted" /> {name}
            </div>
            <div className="text-[10px] text-tcs-muted flex items-center gap-1">
              <Hash size={9} /> {roll}
            </div>
            <div className="text-[10px] text-tcs-muted flex items-center gap-1">
              <FileText size={9} /> Subject: <span className="text-tcs-text font-medium truncate max-w-[140px]">{meta?.name || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
