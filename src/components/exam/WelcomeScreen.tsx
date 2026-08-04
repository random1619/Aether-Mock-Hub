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
  Shuffle,
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
  const optionsShuffled = useExamStore((s) => s.optionsShuffled);
  const setOptionsShuffled = useExamStore((s) => s.setOptionsShuffled);
  const lockBlocked = useExamStore((s) => s.lockBlocked);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

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
    <div className="flex-1 grid place-items-center px-4 py-10 bg-tcs-ink">
      <div className="w-full max-w-4xl border border-tcs-border bg-tcs-panel">
        {/* TCS instruction panel header */}
        <div className="px-5 sm:px-7 py-4 border-b border-tcs-border bg-tcs-panel-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-tcs-muted font-bold">
                Staff Selection Commission
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-tcs-text leading-tight">
                {meta.name}
              </h1>
              {meta.provider && <p className="text-xs text-tcs-muted mt-1">{meta.provider}</p>}
            </div>
            <div className="text-right text-[11px] text-tcs-muted leading-tight">
              <div>
                Exam Mode: <span className="text-tcs-text font-semibold">Computer Based Test</span>
              </div>
              <div>
                Medium: <span className="text-tcs-text font-semibold">English / Hindi</span>
              </div>
            </div>
          </div>
        </div>

        {/* Exam facts row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-tcs-border divide-x divide-tcs-border">
          {details.map((d, i) => (
            <div key={i} className="px-4 py-3.5 bg-tcs-panel">
              <d.icon size={16} className="text-tcs-muted mb-1" />
              <div className="text-base font-extrabold text-tcs-text tabular-nums leading-tight">
                {d.value}
              </div>
              <div className="text-[10px] text-tcs-muted uppercase tracking-wider mt-0.5">
                {d.label}
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
            {/* Important reminders (concise — full list lives in Instructions modal) */}
            <div className="px-5 sm:px-7 py-5 border-b border-tcs-border">
              <h2 className="text-xs uppercase tracking-widest text-tcs-muted font-bold mb-2.5">
                Before you begin
              </h2>
              <ul className="space-y-1.5 text-sm text-tcs-text">
                <li className="flex gap-2">
                  <span className="text-tcs-muted shrink-0">1.</span>
                  <span>Clock runs continuously once started. Auto-submit at time-up.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-tcs-muted shrink-0">2.</span>
                  <span>Save &amp; Next (green) saves and moves on. Mark for Review &amp; Next (violet) flags and moves on. Clear Response (orange) wipes.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-tcs-muted shrink-0">3.</span>
                  <span>Right-side palette shows status at a glance; click any number to jump.</span>
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

            {/* Anti-cheat: option shuffle toggle */}
            <div className="px-5 sm:px-7 py-5 border-b border-tcs-border">
              <label className="inline-flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={optionsShuffled}
                  onChange={() => setOptionsShuffled(!optionsShuffled)}
                  className="mt-0.5 w-4 h-4 accent-[var(--tcs-save)] shrink-0"
                />
                <span className="text-sm font-semibold text-tcs-text flex items-center gap-1.5">
                  <Shuffle size={14} className="text-tcs-muted" />
                  Shuffle answer options
                  <span className="text-tcs-muted font-normal text-xs">
                    (anti-cheat — option order is randomized for this attempt)
                  </span>
                </span>
              </label>
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
  );
}
