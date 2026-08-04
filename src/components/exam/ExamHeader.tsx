import { Maximize, Minimize, BookOpen, User, Hash, FileText, LogOut, Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useExamStore } from '@/stores/examStore';
import { fmtClock } from '@/lib/scoring';
import { clsx } from 'clsx';
import { useSettingsStore } from '@/stores/settingsStore';

/** Pseudo-candidate — pure cosmetic, like the live TCS candidate panel. */
function useCandidate() {
  // In a real app this would come from auth. For the mock, deterministic from exam meta.
  const meta = useExamStore((s) => s.meta);
  const seed = (meta?.path || 'exam').length + (meta?.name || '').length;
  const roll = `SSC${String(2500 + (seed % 7000)).padStart(7, '0')}`;
  const name = 'CANDIDATE NAME';
  return { name, roll };
}

/** Top strip exactly like TCS: brand block left, candidate card right. */
export function ExamHeader({
  onShowInstructions,
  onExit,
}: {
  onShowInstructions: () => void;
  onExit?: () => void;
}) {
  const meta = useExamStore((s) => s.meta);
  const timeRemaining = useExamStore((s) => s.timeRemaining);
  const phase = useExamStore((s) => s.phase);
  const lang = useExamStore((s) => s.lang);
  const setLang = useExamStore((s) => s.setLang);
  const { name, roll } = useCandidate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { theme, toggleTheme } = useSettingsStore();
  const isNetflix = theme === 'netflix';

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

  const warn = phase === 'active' && timeRemaining <= 300 && timeRemaining > 0;
  const netflixTimer = isNetflix && phase === 'active';

  return (
    <header className="relative z-sticky flex items-stretch bg-tcs-header border-b border-tcs-border">
      {/* Left block — brand + exam title */}
      <div className="flex items-center gap-3 px-4 sm:px-5 py-2 min-w-0 flex-1">
        {/* Brand slug — Apple-style blue squircle */}
        <div
          aria-hidden
          className="hidden sm:grid place-items-center w-9 h-9 shrink-0 font-bold text-sm text-white shadow-sm"
          style={{ borderRadius: '24%', background: 'linear-gradient(150deg,#47a5ff 0%,#0071e3 100%)' }}
        >
          A
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-tcs-muted font-bold">
            {meta?.provider || 'Staff Selection Commission'}
          </div>
          <h1 className="text-sm font-bold text-tcs-text truncate">{meta?.name || 'Mock Test'}</h1>
        </div>
      </div>

      {/* Right block — timer + controls + candidate */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 border-l border-tcs-border">
        {phase === 'active' && !isNetflix && (
          <div
            role="timer"
            aria-live="off"
            aria-label={`Time left ${fmtClock(timeRemaining)}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm border font-mono text-[15px] font-bold tabular-nums"
            style={{
              background: warn ? 'var(--tcs-warn-bg)' : 'var(--tcs-panel-2)',
              borderColor: warn ? 'var(--tcs-warn-border)' : 'var(--tcs-border)',
              color: warn ? 'var(--tcs-warn-text)' : 'var(--tcs-text)',
            }}
          >
            <span className="text-[10px] font-sans uppercase text-tcs-muted font-bold tracking-wider mr-1">
              Time Left
            </span>
            {fmtClock(timeRemaining)}
          </div>
        )}

        {/* Netflix Subtitle-style Timer */}
        {netflixTimer && (
          <div
            role="timer"
            aria-live="off"
            aria-label={`Time left ${fmtClock(timeRemaining)}`}
            className="flex items-center gap-1.5 px-2 py-1 rounded-sm font-mono text-xs font-bold tabular-nums bg-black/70 text-white border border-white/20"
          >
            <span className="text-[9px] uppercase tracking-wider text-white/70">Time</span>
            <span className={clsx(warn && 'text-[#f40612]')}>{fmtClock(timeRemaining)}</span>
          </div>
        )}

        {/* View In pill — TCS keeps language toggle in the header */}
        {phase !== 'welcome' && (
          <div className="flex items-center gap-1.5">
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
                  className="px-2.5 py-1 text-xs font-bold transition-colors"
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

        {/* Theme Switcher — change light/dark mode during exam */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme during examination"
          title={`Switch theme (currently ${theme})`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-bold border border-tcs-border text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2 transition-colors cursor-pointer"
        >
          {theme === 'dark' || theme === 'netflix' ? (
            <Sun size={13} className="text-warning-fg" />
          ) : (
            <Moon size={13} className="text-primary" />
          )}
          <span className="hidden sm:inline capitalize">{theme}</span>
        </button>

        <button
          onClick={onShowInstructions}
          aria-label="Show instructions"
          title="Instructions"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-bold border border-tcs-border text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2 transition-colors"
        >
          <BookOpen size={13} />
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
          className="inline-grid place-items-center w-7 h-7 rounded-sm border border-tcs-border text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
        >
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>

        {onExit ? (
          <button
            onClick={onExit}
            aria-label="Exit examination"
            title="Exit examination and return to dashboard"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-xs font-bold border border-tcs-border text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2 transition-colors cursor-pointer"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Exit</span>
          </button>
        ) : (
          <Link
            to="/"
            aria-label="Exit examination"
            title="Exit examination and return to dashboard"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-xs font-bold border border-tcs-border text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2 transition-colors"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Exit</span>
          </Link>
        )}

        {/* Candidate card */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-tcs-border">
          <div
            aria-hidden
            className="w-9 h-10 rounded-sm grid place-items-center bg-tcs-panel-2 border border-tcs-border text-tcs-muted"
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
