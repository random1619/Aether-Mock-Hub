import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExamStore } from '@/stores/examStore';
import { parseMock } from '@/services/mockParser';
import { isRevisionPath, revisionScope, buildRevisionExam } from '@/services/smartRevision';
import { decodeExamParam } from '@/lib/examLink';
import { ExamHeader } from '@/components/exam/ExamHeader';
import { SectionTabs } from '@/components/exam/SectionTabs';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { QuestionPalette, PaletteLegend } from '@/components/exam/QuestionPalette';
import { ExamControls } from '@/components/exam/ExamControls';
import { WelcomeScreen } from '@/components/exam/WelcomeScreen';
import { ResultModal } from '@/components/exam/ResultModal';
import { MobilePaletteDrawer } from '@/components/exam/MobilePaletteDrawer';
import { BackToTop } from '@/components/exam/BackToTop';
import { InstructionsModal } from '@/components/exam/InstructionsModal';
import { FullscreenExitOverlay } from '@/components/exam/FullscreenExitOverlay';
import { FocusLostOverlay } from '@/components/exam/FocusLostOverlay';
import { Modal, Button } from '@/components/ui';
import { Loader2, AlertTriangle, Send } from 'lucide-react';

export default function Exam() {
  const navigate = useNavigate();
  const { encoded } = useParams<{ encoded: string }>();
  // atob throws on malformed base64 — guard here so a hand-typed URL shows
  // the error card instead of crashing the whole page render.
  const path = useMemo<string | null>(() => {
    if (!encoded) return '';
    try {
      return decodeExamParam(encoded);
    } catch {
      return null;
    }
  }, [encoded]);

  const phase = useExamStore((s) => s.phase);
  const loadExam = useExamStore((s) => s.loadExam);
  const tick = useExamStore((s) => s.tick);
  const submit = useExamStore((s) => s.submit);
  const flushProgress = useExamStore((s) => s.flushProgress);
  const reset = useExamStore((s) => s.reset);
  const next = useExamStore((s) => s.next);
  const prev = useExamStore((s) => s.prev);
  const recordFsExit = useExamStore((s) => s.recordFsExit);
  const recordTabSwitch = useExamStore((s) => s.recordTabSwitch);
  const tabSwitches = useExamStore((s) => s.tabSwitches);
  const reattemptMode = useExamStore((s) => s.reattemptMode);
  const toggleReattempt = useExamStore((s) => s.toggleReattempt);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [instOpen, setInstOpen] = useState(false);
  const [showFsOverlay, setShowFsOverlay] = useState(false);
  const [showFocusOverlay, setShowFocusOverlay] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  /** Dedupe: visibilitychange(hidden) and window blur fire together for one
      real focus loss — count at most one violation per cooldown window. */
  const lastFocusViolationRef = useRef(0);

  const handleExit = () => {
    if (phase === 'active') {
      setExitConfirmOpen(true);
    } else {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      navigate('/');
    }
  };

  /* Scroll the question pane to top on question change (a11y + UX) */
  const currentIdx = useExamStore((s) => s.currentIdx);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    if (phase === 'active' || phase === 'submitted') {
      const active = document.activeElement as HTMLElement | null;
      const insidePane = active && mainRef.current?.contains(active);
      if (!insidePane) {
        mainRef.current
          ?.querySelector<HTMLElement>('[data-question-heading]')
          ?.focus({ preventScroll: true });
      }
    }
  }, [currentIdx, phase]);

  /* Load + parse the exam */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    if (path === null) {
      setError('This exam link is malformed. Please pick the mock again from the dashboard.');
      setLoading(false);
      return () => {
        reset();
      };
    }
    // Smart Revision paths are synthetic — the exam is assembled from the
    // wrong-question pool in attempt history instead of a mock file.
    const loader = isRevisionPath(path)
      ? buildRevisionExam(revisionScope(path))
      : parseMock(path);
    loader
      .then(({ meta, questions }) => {
        if (cancelled) return;
        loadExam(meta, questions);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || 'Failed to load exam.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      reset();
    };
  }, [path, loadExam, reset]);

  /* Timer loop */
  useEffect(() => {
    if (phase !== 'active') return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, tick]);

  /* Open the result modal on submit */
  useEffect(() => {
    if (phase === 'submitted') setResultOpen(true);
  }, [phase]);

  /* Warn before tab close / hard navigation while the exam is live. Progress
     IS snapshotted for resume, but leaving mid-exam should still be a
     deliberate choice. */
  useEffect(() => {
    if (phase !== 'active') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  /* Modern tab close/navigation survival: flush any scheduled progress save
     immediately when the tab is hidden, page is unloaded, or page hides. */
  useEffect(() => {
    if (phase !== 'active') return;

    const onFlush = () => {
      flushProgress();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        onFlush();
      }
    };

    window.addEventListener('beforeunload', onFlush);
    window.addEventListener('pagehide', onFlush);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', onFlush);
      window.removeEventListener('pagehide', onFlush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [phase, flushProgress]);

  /* Fullscreen integrity: while active, track exits. Re-entering on user gesture. */
  useEffect(() => {
    if (phase !== 'active') return;

    const onFsChange = () => {
      const inFs = !!document.fullscreenElement;
      if (!inFs) {
        recordFsExit();
        setShowFsOverlay(true);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);

    // Try to (re-)enter fullscreen when the user clicks anywhere while active.
    const onClick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {
          /* browser may block; overlay stays until user explicitly clicks the button */
        });
      }
    };
    window.addEventListener('click', onClick, { capture: true });

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('click', onClick, { capture: true });
    };
  }, [phase, recordFsExit]);

  /* Hide overlay automatically once we're back in fullscreen */
  useEffect(() => {
    if (!showFsOverlay) return;
    const onFs = () => {
      if (document.fullscreenElement) setShowFsOverlay(false);
    };
    document.addEventListener('fullscreenchange', onFs);
    if (document.fullscreenElement) setShowFsOverlay(false);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [showFsOverlay]);

  /* Anti-cheat (active exam only):
     - tab switch / window blur → recorded violation + blocking overlay
     - copy/cut/paste, right-click, and inspect/print/save shortcuts blocked */
  useEffect(() => {
    if (phase !== 'active') return;

    const reportFocusLoss = () => {
      const now = Date.now();
      if (now - lastFocusViolationRef.current < 1500) return;
      lastFocusViolationRef.current = now;
      recordTabSwitch();
      setShowFocusOverlay(true);
    };
    const onVisibility = () => {
      if (document.hidden) reportFocusLoss();
    };
    const prevent = (e: Event) => e.preventDefault();
    const onBlockKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const blocked =
        e.key === 'F12' ||
        (mod && e.shiftKey && ['i', 'j', 'c'].includes(k)) || // devtools
        (mod && ['p', 's', 'u'].includes(k)); // print / save / view-source
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', reportFocusLoss);
    document.addEventListener('copy', prevent);
    document.addEventListener('cut', prevent);
    document.addEventListener('paste', prevent);
    document.addEventListener('contextmenu', prevent);
    window.addEventListener('keydown', onBlockKey, { capture: true });
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', reportFocusLoss);
      document.removeEventListener('copy', prevent);
      document.removeEventListener('cut', prevent);
      document.removeEventListener('paste', prevent);
      document.removeEventListener('contextmenu', prevent);
      window.removeEventListener('keydown', onBlockKey, { capture: true });
    };
  }, [phase, recordTabSwitch]);

  /* Keyboard shortcuts (active exam only). Disabled while any blocking
     dialog/overlay is open so answers can't change invisibly behind it. */
  useEffect(() => {
    if (phase !== 'active') return;
    const dialogOpen = confirmOpen || exitConfirmOpen || instOpen || showFsOverlay || showFocusOverlay;
    if (dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser/OS combos alone
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (/^[1-6]$/.test(e.key)) {
        const optIdx = parseInt(e.key, 10) - 1;
        const { currentIdx, questions, selectOption, optionOrder, optionsShuffled } = useExamStore.getState();
        if (questions[currentIdx]?.options[optIdx] === undefined) return;
        // Number keys follow the DISPLAYED order — map through the shuffle.
        const origIdx = optionsShuffled ? (optionOrder[currentIdx]?.[optIdx] ?? optIdx) : optIdx;
        selectOption(currentIdx, origIdx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, next, prev, confirmOpen, exitConfirmOpen, instOpen, showFsOverlay, showFocusOverlay]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-tcs-ink" data-exam-skin="tcs">
        <div className="flex flex-col items-center gap-3 text-tcs-muted">
          <Loader2 className="animate-spin" size={28} />
          <p className="text-sm font-medium">Preparing your examination…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center bg-tcs-ink px-4" data-exam-skin="tcs">
        <div className="max-w-md w-full bg-tcs-panel border border-tcs-border p-8 text-center">
          <AlertTriangle className="text-warning mx-auto mb-4" size={32} />
          <h1 className="text-xl font-bold text-tcs-text mb-2">Couldn't load this mock</h1>
          <p className="text-sm text-tcs-muted mb-6">{error}</p>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  /* Always render the TCS skin on this page */
  return (
    <div
      className={`h-screen flex flex-col overflow-hidden bg-tcs-ink ${phase === 'active' ? 'select-none' : ''}`}
      data-exam-skin="tcs"
    >
      <ExamHeader onShowInstructions={() => setInstOpen(true)} onExit={handleExit} />
      {phase !== 'welcome' && <SectionTabs />}

      {phase === 'welcome' && <WelcomeScreen />}

      {(phase === 'active' || phase === 'submitted') && (
        <div className="flex flex-1 min-h-0 bg-tcs-ink-2">
          {/* Question pane */}
          <main ref={mainRef} className="relative flex-1 min-w-0 flex flex-col overflow-y-auto">
            <div className="flex-1 px-0 sm:px-2 py-3 sm:py-4">
              <QuestionCard />
            </div>

            {/* TCS action bar — sticky at the bottom of the question pane */}
            <div className="sticky bottom-0 z-raised border-t border-tcs-border bg-tcs-action-bg px-3 sm:px-4 py-2.5 mt-auto">
              {phase === 'active' && <ExamControls onSubmit={() => setConfirmOpen(true)} />}

              {phase === 'submitted' && (
                <div className="flex items-center justify-between gap-3 flex-wrap text-tcs-text">
                  <Button variant="secondary" size="md" onClick={prev}>
                    &larr; Previous
                  </Button>
                  <label className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-tcs-muted cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={reattemptMode}
                      onChange={toggleReattempt}
                      className="w-3.5 h-3.5 accent-[var(--primary)]"
                    />
                    Re-attempt Questions
                  </label>
                  <Button variant="primary" size="md" onClick={next}>
                    Next &rarr;
                  </Button>
                </div>
              )}
            </div>

            <BackToTop scrollRef={mainRef} />
          </main>

          {/* Right sidebar: candidate + palette, exactly TCS layout */}
          <aside className="hidden md:flex w-72 lg:w-80 shrink-0 flex-col border-l border-tcs-border bg-tcs-panel overflow-y-auto">
            <div className="px-4 lg:px-5 py-4 border-b border-tcs-border bg-tcs-panel-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-tcs-muted mb-2">
                {phase === 'submitted' ? 'Review Palette' : 'Question Palette'}
              </div>
              {/* Legend only makes sense while answering — post-submit the tiles
                  show correct/incorrect, which the legend doesn't describe. */}
              {phase === 'active' && <PaletteLegend />}
            </div>
            <div className="px-3 lg:px-4 py-4 flex-1">
              <QuestionPalette />
            </div>
            {phase === 'submitted' && (
              <div className="px-4 lg:px-5 py-4 border-t border-tcs-border">
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  leftIcon={<Send size={13} />}
                  onClick={() => setResultOpen(true)}
                >
                  View Summary
                </Button>
              </div>
            )}
          </aside>

          {/* Mobile palette */}
          <MobilePaletteDrawer onShowSummary={() => setResultOpen(true)} />
        </div>
      )}

      {/* Submit confirmation */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Submit Examination?">
        <p className="text-sm text-tcs-text mb-2">
          <strong>You are about to submit the examination.</strong>
        </p>
        <p className="text-sm text-tcs-muted mb-5 leading-relaxed">
          Once submitted, you cannot change any answers. Make sure you have reviewed every question
          you marked for review.
        </p>
        <div className="flex gap-2.5">
          <Button variant="secondary" fullWidth onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            leftIcon={<Send size={14} />}
            onClick={() => {
              setConfirmOpen(false);
              // Best-effort: exit fullscreen on submit (TCS semantics)
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              submit();
            }}
          >
            Submit
          </Button>
        </div>
      </Modal>

      {/* Exit & Submit confirmation */}
      <Modal
        open={exitConfirmOpen}
        onClose={() => setExitConfirmOpen(false)}
        title="Submit Examination & Exit?"
      >
        <p className="text-sm text-tcs-text mb-2">
          <strong>Do you want to submit your examination before exiting?</strong>
        </p>
        <p className="text-sm text-tcs-muted mb-5 leading-relaxed">
          Submitting will evaluate your answers and return you to the dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Button variant="secondary" fullWidth onClick={() => setExitConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            fullWidth
            onClick={() => {
              setExitConfirmOpen(false);
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              navigate('/');
            }}
          >
            Exit Without Submitting
          </Button>
          <Button
            variant="primary"
            fullWidth
            leftIcon={<Send size={14} />}
            onClick={() => {
              setExitConfirmOpen(false);
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              submit();
              navigate('/');
            }}
          >
            Submit &amp; Exit
          </Button>
        </div>
      </Modal>

      <InstructionsModal open={instOpen} onClose={() => setInstOpen(false)} />
      <ResultModal open={resultOpen} onClose={() => setResultOpen(false)} />

      {/* Fullscreen exit guard */}
      {showFsOverlay && phase === 'active' && !confirmOpen && (
        <FullscreenExitOverlay
          onReenter={() => {
            document.documentElement.requestFullscreen().catch(() => {});
            setShowFsOverlay(false);
          }}
        />
      )}

      {/* Tab-switch / focus-loss guard */}
      {showFocusOverlay && phase === 'active' && !confirmOpen && (
        <FocusLostOverlay count={tabSwitches} onResume={() => setShowFocusOverlay(false)} />
      )}
    </div>
  );
}
