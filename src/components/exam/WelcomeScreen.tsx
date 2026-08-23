import {
  Play,
  Clock,
  FileQuestion,
  AlertTriangle,
  Maximize,
  Award,
  ListChecks,
  Sun,
  Moon,
  ArrowRight,
  ArrowLeft,
  ScrollText,
  History,
  BookOpen,
  RotateCcw,
} from 'lucide-react';
import { useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useExamStore } from '@/stores/examStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/components/ui';
import { fmtClock } from '@/lib/scoring';

dayjs.extend(relativeTime);

type Step = 'overview' | 'declaration';

/**
 * TCS-style "Welcome / read instructions" gate.
 *
 * Two steps, matching the real SSC CBT flow:
 *   1. Overview — exam facts + key reminders, then "Next".
 *   2. Declaration — pick light/dark theme, tick the honesty declaration,
 *      then "I am ready to begin" (requests fullscreen, starts the timer).
 */
export function WelcomeScreen() {
  const meta = useExamStore((s) => s.meta);
  const questions = useExamStore((s) => s.questions);
  const startExam = useExamStore((s) => s.startExam);
  const resumeAvailable = useExamStore((s) => s.resumeAvailable);
  const resumeExam = useExamStore((s) => s.resumeExam);
  const discardResume = useExamStore((s) => s.discardResume);
  const lockBlocked = useExamStore((s) => s.lockBlocked);
  const latestAttempt = useExamStore((s) => s.latestAttempt);
  const allAttempts = useExamStore((s) => s.allAttempts);
  const reviewAttempt = useExamStore((s) => s.reviewAttempt);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const patternDescription = useExamStore((s) => s.patternDescription);
  const sectionalTimerEnabled = useExamStore((s) => s.sectionalTimerEnabled);
  const setSectionalTimerEnabled = useExamStore((s) => s.setSectionalTimerEnabled);

  const [step, setStep] = useState<Step>('overview');
  const [declared, setDeclared] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  if (!meta) return null;

  const totalMarks = questions.reduce((sum, q) => sum + (q.marks ?? 2), 0);

  const details = [
    { icon: FileQuestion, label: 'Total Questions', value: String(questions.length) },
    { icon: Clock, label: 'Duration', value: `${meta.durationMinutes} mins` },
    { icon: Award, label: 'Total Marks', value: String(totalMarks) },
    { icon: ListChecks, label: 'Sections', value: String(meta.sections.length) },
  ];

  const tryFullscreen = async (): Promise<void> => {
    try {
      // TCS behaviour: attempt fullscreen on user gesture before activating
      await document.documentElement.requestFullscreen();
      setFullscreenError(false);
    } catch {
      // Browser blocked or unsupported — still allow starting, just surface a note.
      setFullscreenError(true);
    }
  };

  const start = async () => {
    // Lock check first: a second tab holding this mock leaves us on welcome.
    if (!startExam()) return;
    await tryFullscreen();
  };

  const resume = async () => {
    if (!resumeExam()) return;
    await tryFullscreen();
  };

  const resumeAnswered = resumeAvailable ? Object.keys(resumeAvailable.answers).length : 0;
  const resumeRemaining = resumeAvailable
    ? Math.max(0, Math.ceil((resumeAvailable.endsAt - Date.now()) / 1000))
    : 0;

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 py-4 sm:py-8 bg-tcs-ink"
      style={{
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        overscrollBehavior: 'contain',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))',
      } as any}
    >
      <div className="min-h-full flex flex-col items-center justify-start py-3 sm:py-6">
        <div className="w-full max-w-4xl border border-tcs-border/60 bg-tcs-panel shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] rounded-xl sm:rounded-2xl overflow-hidden">
        {/* Impeccable header — refined with subtle gradient and inner highlight */}
        <div className="px-5 sm:px-7 py-5 sm:py-6 border-b border-tcs-border/60 bg-gradient-to-b from-tcs-panel to-tcs-panel-2/60 relative overflow-hidden">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-tcs-muted font-extrabold">
                <span className="w-1 h-1 rounded-full bg-primary animate-pulse" aria-hidden />
                Staff Selection Commission
              </div>
              <h1 className="text-xl sm:text-[26px] font-black tracking-[-0.015em] text-tcs-text leading-tight mt-1">
                {meta.name}
              </h1>
              {meta.provider && <p className="text-xs font-medium text-tcs-muted mt-1.5 flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-tcs-muted" />{meta.provider}</p>}
            </div>
            <div className="flex gap-2">
              <div className="hidden sm:flex flex-col items-center px-3 py-2 rounded-xl bg-surface border border-tcs-border/60 shadow-sm">
                <span className="text-[10px] uppercase tracking-widest font-bold text-tcs-muted">Mode</span>
                <span className="text-xs font-bold text-tcs-text">CBT</span>
              </div>
              <div className="hidden sm:flex flex-col items-center px-3 py-2 rounded-xl bg-surface border border-tcs-border/60 shadow-sm">
                <span className="text-[10px] uppercase tracking-widest font-bold text-tcs-muted">Medium</span>
                <span className="text-xs font-bold text-tcs-text">EN / HI</span>
              </div>
              <div className="sm:hidden text-right text-[11px] text-tcs-muted leading-tight bg-surface px-2.5 py-1.5 rounded-lg border border-tcs-border/60">
                <div>Mode: <span className="text-tcs-text font-bold">CBT</span></div>
                <div>Medium: <span className="text-tcs-text font-bold">EN / HI</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Exam facts — impeccable cards with subtle lift */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-tcs-border/60 border-b border-tcs-border/60 bg-tcs-panel-2/30">
          {details.map((d, i) => (
            <div key={i} className="px-4 py-4 sm:py-5 bg-tcs-panel hover:bg-surface transition-colors group">
              <div className="w-7 h-7 rounded-full bg-surface-2 border border-tcs-border/60 grid place-items-center mb-2 group-hover:border-primary/20 group-hover:bg-primary-soft transition-colors">
                <d.icon size={14} className="text-tcs-muted group-hover:text-primary transition-colors" />
              </div>
              <div className="text-[11px] text-tcs-muted uppercase tracking-widest font-bold">{d.label}</div>
              <div className="text-lg sm:text-xl font-black tracking-[-0.015em] text-tcs-text tabular-nums leading-none mt-1">
                {d.value}
              </div>
            </div>
          ))}
        </div>

        {/* Lock banner: another tab/window is already running THIS mock. */}
        {lockBlocked && (
          <div className="px-5 sm:px-7 py-4 border-b border-warning/40 bg-warning/10">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-bold text-tcs-text">This mock is already in progress</div>
                <div className="text-tcs-muted text-xs mt-0.5">
                  Another tab or window holds an active attempt for this test. Close it (or wait a
                  few seconds for its lock to expire) and try again.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Previous Attempt Banner: User has already attempted this mock.
            Allows reviewing submitted responses & solutions or taking a fresh attempt. */}
        {allAttempts.length > 0 && step === 'overview' && (
          <div className="border-b border-tcs-border bg-gradient-to-r from-primary/10 via-tcs-panel to-primary/5 divide-y divide-tcs-border/60">
            {/* Primary Latest Attempt Strip */}
            <div className="px-5 sm:px-7 py-4 sm:py-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary border border-primary/20 grid place-items-center shrink-0 shadow-xs">
                    <Award size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-tcs-text">
                        Latest Attempt #{latestAttempt?.attemptNumber ?? allAttempts.length} Record
                      </span>
                      {latestAttempt && (
                        <span className="text-[11px] font-bold text-tcs-muted">
                          · Submitted {dayjs(latestAttempt.submittedAt).fromNow()}
                        </span>
                      )}
                      {latestAttempt && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-answered/15 text-answered border border-answered/30">
                          Score: {latestAttempt.score.toFixed(1)} / {latestAttempt.maxScore.toFixed(0)} ({latestAttempt.accuracy}%)
                        </span>
                      )}
                    </div>
                    {latestAttempt && (
                      <div className="flex items-center gap-2.5 text-xs text-tcs-muted mt-1.5 flex-wrap font-medium">
                        <span className="text-answered font-bold">✓ {latestAttempt.correct} Correct</span>
                        <span>•</span>
                        <span className="text-notanswered font-bold">✗ {latestAttempt.incorrect} Incorrect</span>
                        <span>•</span>
                        <span>— {latestAttempt.unattempted} Skipped</span>
                        <span>•</span>
                        <span className="text-primary font-semibold">{allAttempts.length} attempt{allAttempts.length > 1 ? 's' : ''} recorded</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <Button
                    size="md"
                    leftIcon={<BookOpen size={15} />}
                    onClick={() => reviewAttempt(latestAttempt || undefined)}
                    className="font-bold text-xs sm:text-sm px-4 shadow-sm"
                    style={{ background: 'var(--tcs-submit)', color: 'var(--tcs-submit-fg)', borderColor: 'transparent' }}
                  >
                    Review Solutions &amp; Responses
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    leftIcon={<RotateCcw size={14} />}
                    onClick={() => setStep('declaration')}
                    className="font-semibold text-xs sm:text-sm"
                  >
                    Re-attempt Mock
                  </Button>
                </div>
              </div>
            </div>

            {/* If multiple attempts exist, show all past attempts with individual review buttons */}
            {allAttempts.length > 1 && (
              <div className="px-5 sm:px-7 py-3.5 bg-tcs-panel-2/40">
                <div className="text-[11px] font-bold uppercase tracking-wider text-tcs-muted mb-2.5 flex items-center justify-between">
                  <span>All Previous Attempts ({allAttempts.length})</span>
                  <span className="text-[10px] font-medium text-tcs-muted">Click any attempt to inspect its response sheet</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {allAttempts.slice().reverse().map((att) => (
                    <div
                      key={att.attemptNumber}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-tcs-border/60 bg-surface hover:bg-surface-2 transition-colors gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-tcs-text">Attempt #{att.attemptNumber}</span>
                          <span className="text-[10px] text-tcs-muted truncate">({dayjs(att.submittedAt).format('MMM D, h:mm A')})</span>
                        </div>
                        <div className="text-[11px] font-semibold text-tcs-muted mt-0.5">
                          <span className="text-tcs-text font-bold">{att.score.toFixed(1)}</span>/{att.maxScore.toFixed(0)} · <span className={att.accuracy >= 70 ? 'text-answered' : 'text-primary'}>{att.accuracy}% acc</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => reviewAttempt(att)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors shrink-0 cursor-pointer"
                        title={`Review Attempt #${att.attemptNumber}`}
                      >
                        <BookOpen size={11} /> Review
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resume banner: a previous session left an in-progress attempt.
            The wall clock kept running while away — no free time. */}
        {resumeAvailable && step === 'overview' && (
          <div className="px-5 sm:px-7 py-4 border-b border-tcs-border bg-[var(--tcs-save)]/10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <History size={16} className="text-[var(--tcs-save)] shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-bold text-tcs-text">
                    An in-progress attempt was found
                  </div>
                  <div className="text-tcs-muted text-xs mt-0.5">
                    {resumeAnswered} of {questions.length} answered ·{' '}
                    <span className="font-semibold text-tcs-text">{fmtClock(resumeRemaining)}</span>{' '}
                    remaining · saved {dayjs(resumeAvailable.savedAt).fromNow()}. The clock kept
                    running while you were away.
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={discardResume}
                  className="font-bold text-xs"
                >
                  Start fresh
                </Button>
                <Button
                  size="sm"
                  leftIcon={<Play size={13} />}
                  onClick={resume}
                  className="font-bold text-xs"
                  style={{ background: 'var(--tcs-save)', color: 'var(--tcs-save-fg)', borderColor: 'transparent' }}
                >
                  Resume attempt
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'overview' && (
          <>
            {/* Exam Pattern & Section Breakdown */}
            {meta.sections.length > 0 && (
              <div className="px-5 sm:px-7 py-5 border-b border-tcs-border bg-tcs-panel-2/50">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 className="text-xs uppercase tracking-widest text-tcs-muted font-bold">
                    Sectional Structure &amp; Timings
                  </h2>
                  {patternDescription && (
                    <span className="text-[11px] font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                      {patternDescription}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {meta.sections.map((sec, idx) => {
                    const qCount = sec.end - sec.start + 1;
                    const mins = sec.durationMinutes || 15;
                    return (
                      <div
                        key={idx}
                        className="group flex items-center justify-between p-3 rounded-xl border border-tcs-border/60 bg-tcs-panel hover:bg-surface hover:border-primary/20 hover:shadow-sm transition-all text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-full bg-tcs-panel-2 border border-tcs-border/60 grid place-items-center text-[11px] font-black text-tcs-muted group-hover:text-primary group-hover:border-primary/20 transition-colors shrink-0">
                            {idx + 1}
                          </span>
                          <div className="font-semibold text-tcs-text truncate pr-2 leading-tight">
                            {sec.name.replace(/^Section \d+:\s*/,'')}
                            <span className="block text-[10px] font-medium text-tcs-muted">{qCount} Questions</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold tabular-nums">
                            <Clock size={10} /> {mins}m
                          </span>
                          <span className="text-[10px] text-tcs-muted font-medium">{qCount}Q • {(mins*60/qCount).toFixed(1)}s/Q</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {meta.sections.length > 1 && (
                  <div className="mt-3 flex items-center justify-between pt-3 border-t border-tcs-border/60">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sectionalTimerEnabled}
                        onChange={(e) => setSectionalTimerEnabled(e.target.checked)}
                        className="w-4 h-4 accent-[var(--tcs-save)]"
                      />
                      <span className="text-xs font-bold text-tcs-text">
                        Enforce Sectional Timers &amp; Section Locks
                      </span>
                    </label>
                    <span className="text-[11px] text-tcs-muted hidden sm:inline">
                      {sectionalTimerEnabled
                        ? 'Sections auto-lock when submitted / time ends'
                        : 'Free navigation between all sections'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Important reminders (concise — full list lives in Instructions modal) */}
            <div className="px-5 sm:px-7 py-5 border-b border-tcs-border">
              <h2 className="text-xs uppercase tracking-widest text-tcs-muted font-bold mb-2.5">
                Before you begin
              </h2>
              <ul className="space-y-1.5 text-sm text-tcs-text">
                <li className="flex gap-2">
                  <span className="text-tcs-muted shrink-0">1.</span>
                  <span>
                    {sectionalTimerEnabled
                      ? 'Each section has a dedicated countdown timer. When section time expires or is submitted, it is locked.'
                      : 'Clock runs continuously once started. Auto-submit at time-up.'}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-tcs-muted shrink-0">2.</span>
                  <span>
                    Save &amp; Next (green) saves and moves on. Mark for Review &amp; Next (violet) flags and moves on. Clear Response (orange) wipes.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-tcs-muted shrink-0">3.</span>
                  <span>
                    {sectionalTimerEnabled
                      ? 'During the active exam, you can only attempt questions in the current section. All sections unlock for full review after test submission.'
                      : 'Right-side palette shows status at a glance; click any number to jump.'}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-tcs-muted shrink-0">4.</span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    Test will enter <Maximize size={13} className="inline" /> when you begin. Exiting fullscreen is recorded as a violation.
                  </span>
                </li>
              </ul>
            </div>

            {/* Action bar — Next */}
            <div className="px-5 sm:px-7 py-5 bg-tcs-panel-2 flex flex-col items-stretch sm:items-end gap-2">
              <Button
                size="lg"
                rightIcon={<ArrowRight size={16} />}
                onClick={() => setStep('declaration')}
                className="font-bold tracking-wide uppercase text-sm px-8"
                style={{ background: 'var(--tcs-submit)', color: 'var(--tcs-submit-fg)', borderColor: 'transparent' }}
              >
                Next
              </Button>
            </div>
          </>
        )}

        {step === 'declaration' && (
          <>
            {/* Theme picker */}
            <div className="px-5 sm:px-7 py-5 border-b border-tcs-border">
              <h2 className="text-xs uppercase tracking-widest text-tcs-muted font-bold mb-3">
                Choose your interface theme
              </h2>
              <div className="grid grid-cols-3 gap-3 max-w-lg">
                {(
                  [
                    { value: 'light' as const, label: 'Light', icon: Sun },
                    { value: 'dark' as const, label: 'Dark', icon: Moon },
                    { value: 'netflix' as const, label: 'Netflix', icon: null },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTheme(opt.value)}
                    className={`flex items-center gap-3 px-4 py-3 border rounded-sm text-sm font-semibold transition-all cursor-pointer ${
                      theme === opt.value
                        ? 'border-[var(--tcs-submit)] bg-[var(--tcs-submit)]/10 text-tcs-text shadow-[0_0_0_1px_var(--tcs-submit)]'
                        : 'border-tcs-border bg-tcs-action-bg text-tcs-muted hover:border-[var(--tcs-submit)]/50 hover:text-tcs-text'
                    }`}
                  >
                    {opt.value === 'netflix' ? (
                      <span
                        aria-hidden
                        className="w-[18px] h-[18px] grid place-items-center rounded-[3px] text-white text-[10px] font-black shrink-0"
                        style={{ background: 'linear-gradient(180deg,#f6121d,#b20710)' }}
                      >
                        N
                      </span>
                    ) : (
                      opt.icon && <opt.icon size={18} />
                    )}
                    {opt.label}
                    {theme === opt.value && (
                      <span className="ml-auto text-[var(--tcs-submit)] text-xs font-bold">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>


            {/* Declaration */}
            <div className="px-5 sm:px-7 py-5 border-b border-tcs-border">
              <h2 className="text-xs uppercase tracking-widest text-tcs-muted font-bold mb-3 flex items-center gap-1.5">
                <ScrollText size={13} /> Declaration
              </h2>
              <div className="text-sm text-tcs-text leading-relaxed mb-4 space-y-2">
                <p>
                  I have read and understood the instructions. I affirm that I am the genuine
                  candidate appearing for this examination and will not use any unfair means.
                </p>
                <p className="text-tcs-muted text-xs">
                  All question responses, flags, and time spent are recorded for review and analytics.
                  Exiting fullscreen or switching tabs/windows during the test is logged as an
                  integrity violation.
                </p>
              </div>
              <label className="inline-flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={declared}
                  onChange={() => setDeclared(!declared)}
                  className="mt-0.5 w-4 h-4 accent-[var(--tcs-save)] shrink-0"
                />
                <span className="text-sm font-semibold text-tcs-text">
                  I agree to the above declaration and want to proceed.
                </span>
              </label>
            </div>

            {/* Action bar — Back + Begin */}
            <div className="px-5 sm:px-7 py-5 bg-tcs-panel-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <Button
                variant="secondary"
                size="md"
                leftIcon={<ArrowLeft size={14} />}
                onClick={() => setStep('overview')}
                className="font-bold tracking-wide text-sm"
              >
                Back
              </Button>
              <div className="flex flex-col items-stretch sm:items-end gap-2">
                {resumeAvailable && (
                  <div className="flex items-center gap-2 text-warning text-xs font-medium">
                    <AlertTriangle size={13} /> Starting fresh discards your saved in-progress attempt
                    ({resumeAnswered} answered). Go Back and choose “Resume attempt” to keep it.
                  </div>
                )}
                {fullscreenError && (
                  <div className="flex items-center gap-2 text-warning text-xs font-medium">
                    <AlertTriangle size={13} /> Fullscreen was blocked by your browser; the test will try to re-enter fullscreen on your next click.
                  </div>
                )}
                <Button
                  size="lg"
                  leftIcon={<Play size={16} />}
                  onClick={start}
                  disabled={!declared}
                  className="font-bold tracking-wide uppercase text-sm px-8"
                  style={{ background: 'var(--tcs-save)', color: 'var(--tcs-save-fg)', borderColor: 'transparent' }}
                >
                  I am ready to begin
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
  );
}
