/* EXAM STORE — the exam engine state machine (Zustand).
   Owns: questions, answers, flags, visited, timer, sections,
   navigation, review mode, scoring. Pure logic lives in lib/scoring. */
import { create } from 'zustand';
import type { ExamMeta, ExamPhase, Question, PerQuestionRecord, LangView } from '@/types';
import { scoreAttempt, type ScoreResult } from '@/lib/scoring';
import { saveAttempt, attachAttemptToSaved, recordSubjectAttempt, storageHealthy } from '@/services/attemptStore';
import {
  saveProgress,
  loadProgressFor,
  loadProgressFromDisk,
  clearProgress,
  type ExamProgressSnapshot,
} from '@/services/examProgress';
import { startBatteryWatch, stopBatteryWatch } from '@/services/batteryWatch';
import {
  acquireExamLock,
  heartbeatExamLock,
  releaseExamLock,
  LOCK_HEARTBEAT_MS,
} from '@/services/examLock';

/** Cap one flush of per-question elapsed time: a suspended background tab
    would otherwise accrue hours into the question the user left open. */
const MAX_FLUSH_SECS = 600;
/** Debounce for progress snapshots — a click burst shouldn't rewrite storage
    on every keystroke. */
const PROGRESS_SAVE_DEBOUNCE_MS = 750;
/** Keep the persisted violation counters bounded so the attempt stays small. */
const MAX_FS_EXITS = 999;
const MAX_TAB_SWITCHES = 999;
/** Wall-clock vs monotonic-clock drift beyond this in a single tick means the
    system clock moved mid-exam (NTP corrections stay well under it). */
const CLOCK_TAMPER_MS = 15000;

interface ExamState {
  meta: ExamMeta | null;
  questions: Question[];
  phase: ExamPhase;

  currentIdx: number;
  answers: Record<number, number>;
  flags: Set<number>;
  visited: Set<number>;

  /** Seconds remaining (whole exam or active section). */
  timeRemaining: number;
  /** Seconds spent per question. */
  questionTimes: Record<number, number>;

  isSectionalMode: boolean;
  currentSectionIdx: number;

  /** Review mode */
  reattemptMode: boolean;
  revealedSolutions: Set<number>;
  lang: LangView;

  /** TCS-style anti-cheese: count of fullscreen exits during active phase. */
  fsExits: number;
  /** Focus-loss violations (tab switch / window blur) during active phase. */
  tabSwitches: number;
  /** Wall-clock jump detected mid-exam (possible timer tampering). */
  clockTampered: boolean;
  /** Shuffle answer options during the active phase (anti-cheat). */
  optionsShuffled: boolean;
  /** qIdx → display permutation of ORIGINAL option indices (answers are
      always stored in original space, so scoring is unaffected). */
  optionOrder: Record<number, number[]>;
  /** True when start/resume was refused: another tab holds this mock's lock. */
  lockBlocked: boolean;

  result: ScoreResult | null;
  /** Frozen copy of answers at submit time. Re-attempt mode keeps mutating
      `answers` as a working copy, so review UI must read THIS to show what
      the user actually submitted. Null until submitted. */
  submittedAnswers: Record<number, number> | null;
  /** A resumable in-progress snapshot found for this mock at loadExam time.
      Surfaced on the WelcomeScreen as a "Resume?" banner. */
  resumeAvailable: ExamProgressSnapshot | null;
  /** True when the last submit succeeded in scoring but failed to persist
      to localStorage (quota / private mode). The result modal shows a
      warning so the user knows their score won't survive a reload. */
  persistFailed: boolean;

  /* ── actions ── */
  loadExam: (meta: ExamMeta, questions: Question[]) => void;
  /** Returns false when another tab/window holds this mock's attempt lock. */
  startExam: () => boolean;
  /** Restore the resumeAvailable snapshot into a live active exam.
      Returns false when the attempt lock is held elsewhere. */
  resumeExam: () => boolean;
  /** Throw away the resume snapshot and present a clean welcome screen. */
  discardResume: () => void;
  navigateTo: (idx: number) => void;
  /** Switch the active section (sectional exams). Unlocks navigation into that section. */
  setCurrentSection: (secIdx: number) => void;
  next: () => void;
  prev: () => void;
  selectOption: (qIdx: number, optIdx: number) => void;
  clearSelection: (qIdx: number) => void;
  toggleFlag: (qIdx: number) => void;
  /** TCS: Save & Next — keep current answer, move to next question. */
  saveNext: () => void;
  /** TCS: Mark for Review & Next — flag current, move to next question. */
  markAndNext: () => void;
  /** TCS: Clear Response — wipe the option chosen for current Q. */
  clearAndStay: () => void;
  /** Record that the user exited fullscreen during the active phase. */
  recordFsExit: () => void;
  /** Record a focus-loss violation (tab switch / window blur). */
  recordTabSwitch: () => void;
  /** Pre-start preference: shuffle option order during the active phase. */
  setOptionsShuffled: (v: boolean) => void;
  tick: () => void;
  setLang: (lang: LangView) => void;
  toggleReattempt: () => void;
  revealSolution: (qIdx: number) => void;
  submit: () => void;
  flushProgress: () => void;
  reset: () => void;
}

let _qEnterTs: number | null = null;
/** Wall-clock deadline (ms epoch) for the active exam. The countdown is derived
    from Date.now() each tick, so background-tab throttling or sleep can never
    grant extra time — setInterval is only a UI refresh trigger. */
let _endsAt: number | null = null;
let _progressTimer: ReturnType<typeof setTimeout> | null = null;
/** Last tick's wall + monotonic readings, for clock-tamper detection.
    performance.now() is monotonic (immune to system-clock edits); a wall
    jump without a matching monotonic jump means the clock was tampered. */
let _lastTickWall: number | null = null;
let _lastTickMono: number | null = null;
/** Interval that keeps this tab's attempt lock fresh while the exam runs. */
let _lockTimer: ReturnType<typeof setInterval> | null = null;

/** Time-remaining thresholds (seconds) at which a native notification
    fires once. The set is reset on every startExam/resumeExam so each
    exam gets its own warnings. */
const TIME_WARN_SECS = [600, 300, 60]; // 10 min, 5 min, 1 min
let _warnedThresholds = new Set<number>();

/** Desktop bridge: exam lifecycle hooks. startExam keeps the display awake
    (power-save blocker) and arms the main process's AC-unplug warning. */
function desktopExamStart(): void {
  try { (window as any).aetherDesktop?.startExam?.(); } catch { /* non-Electron */ }
  startBatteryWatch();
}
function desktopExamEnd(): void {
  try { (window as any).aetherDesktop?.endExam?.(); } catch { /* non-Electron */ }
  stopBatteryWatch();
}

/** Fisher–Yates permutation of each question's option indices. The store and
    scorer never see the shuffle — answers are recorded in original space. */
function buildOptionOrder(questions: Question[]): Record<number, number[]> {
  const order: Record<number, number[]> = {};
  questions.forEach((q, idx) => {
    const perm = q.options.map((_, i) => i);
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    order[idx] = perm;
  });
  return order;
}

function startLockHeartbeat(): void {
  stopLockHeartbeat();
  _lockTimer = setInterval(heartbeatExamLock, LOCK_HEARTBEAT_MS);
}

function stopLockHeartbeat(): void {
  if (_lockTimer) {
    clearInterval(_lockTimer);
    _lockTimer = null;
  }
}

export const useExamStore = create<ExamState>((set, get) => ({
  meta: null,
  questions: [],
  phase: 'welcome',
  currentIdx: 0,
  answers: {},
  flags: new Set(),
  visited: new Set([0]),
  timeRemaining: 0,
  questionTimes: {},
  isSectionalMode: false,
  currentSectionIdx: 0,
  reattemptMode: false,
  revealedSolutions: new Set(),
  // Default to 'both': most mocks are code-mixed, so a single-script view would
  // delete legitimate words. 'both' renders the source verbatim (lossless).
  lang: 'both',
  fsExits: 0,
  tabSwitches: 0,
  clockTampered: false,
  optionsShuffled: true,
  optionOrder: {},
  lockBlocked: false,
  result: null,
  submittedAnswers: null,
  resumeAvailable: null,
  persistFailed: false,

  loadExam: (meta, questions) => {
    const isSectional = meta.sections.length > 1;
    _endsAt = null;
    _lastTickWall = null;
    _lastTickMono = null;
    cancelScheduledProgressSave();
    desktopExamEnd(); // belt-and-braces if a previous exam wasn't reset cleanly
    stopLockHeartbeat();
    releaseExamLock();
    set({
      meta,
      questions,
      phase: 'welcome',
      currentIdx: 0,
      answers: {},
      flags: new Set(),
      visited: new Set([0]),
      timeRemaining: meta.durationMinutes * 60,
      questionTimes: {},
      isSectionalMode: isSectional,
      currentSectionIdx: 0,
      reattemptMode: false,
      revealedSolutions: new Set(),
      fsExits: 0,
      tabSwitches: 0,
      clockTampered: false,
      optionOrder: {},
      lockBlocked: false,
      result: null,
      submittedAnswers: null,
      persistFailed: false,
      // 360 Mocks are now tagged with explicit eqt/hqt markers at parse time,
      // so a single-language view is exact (no loanword loss). Default them to
      // English; the user can still flip to HI / BOTH in the header. Every
      // other provider keeps the lossless 'both' default.
      lang: /(^|\/)providers\/Mocks360\//i.test(meta.path) ? 'en' : 'both',
      // Offer a resume only when a snapshot matches THIS mock and its clock
      // hasn't already expired (loadProgressFor enforces both).
      resumeAvailable: loadProgressFor(meta.path),
    });
    // Crash recovery: localStorage commits are async and can be lost in a
    // hard crash. Fall back to the atomic on-disk mirror (Electron only).
    if (!get().resumeAvailable) {
      loadProgressFromDisk(meta.path).then((snap) => {
        // Don't clobber a newer state if the user already started the exam.
        if (snap && get().phase === 'welcome' && get().meta?.path === meta.path) {
          set({ resumeAvailable: snap });
        }
      });
    }
  },

  startExam: () => {
    const meta = get().meta;
    // Single-attempt lock: the same mock can't run in two tabs/windows.
    if (meta && !acquireExamLock(meta.path)) {
      set({ lockBlocked: true });
      return false;
    }
    // A fresh start supersedes any saved snapshot for this mock.
    clearProgress();
    _qEnterTs = Date.now();
    // Set the wall-clock deadline once; tick() derives remaining time from it.
    _endsAt = Date.now() + get().timeRemaining * 1000;
    _warnedThresholds = new Set();
    _lastTickWall = null;
    _lastTickMono = null;
    desktopExamStart();
    startLockHeartbeat();
    const shuffle = get().optionsShuffled;
    set({
      phase: 'active',
      resumeAvailable: null,
      lockBlocked: false,
      optionOrder: shuffle ? buildOptionOrder(get().questions) : {},
    });
    // Persist right away so a fast crash/resume keeps the same option layout.
    scheduleProgressSave(get);
    return true;
  },

  resumeExam: () => {
    const snap = get().resumeAvailable;
    if (!snap || get().phase !== 'welcome') return false;
    if (!acquireExamLock(snap.path)) {
      set({ lockBlocked: true });
      return false;
    }
    _endsAt = snap.endsAt;
    _qEnterTs = Date.now();
    _warnedThresholds = new Set();
    _lastTickWall = null;
    _lastTickMono = null;
    desktopExamStart();
    startLockHeartbeat();
    const remaining = Math.max(0, Math.ceil((_endsAt - Date.now()) / 1000));
    // Strip null answers — they can appear in hand-edited snapshots after
    // clearSelection writes. Null in the record is semantically "no answer".
    const cleanAnswers: Record<number, number> = {};
    for (const [k, v] of Object.entries(snap.answers)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        cleanAnswers[Number(k)] = v;
      }
    }
    const cleanTimes: Record<number, number> = {};
    for (const [k, v] of Object.entries(snap.questionTimes)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        cleanTimes[Number(k)] = v;
      }
    }
    // Restore the same option shuffle the attempt started with — a missing
    // order (legacy snapshot) is regenerated; scoring is unaffected either
    // way because answers live in original index space.
    const shuffled = snap.optionsShuffled ?? false;
    const restoredOrder =
      shuffled && snap.optionOrder && Object.keys(snap.optionOrder).length > 0
        ? snap.optionOrder
        : shuffled
          ? buildOptionOrder(get().questions)
          : {};
    set({
      phase: 'active',
      answers: cleanAnswers,
      flags: new Set(snap.flags),
      visited: new Set(snap.visited),
      currentIdx: Math.min(snap.currentIdx, get().questions.length - 1),
      currentSectionIdx: snap.currentSectionIdx,
      questionTimes: cleanTimes,
      fsExits: snap.fsExits,
      tabSwitches: snap.tabSwitches ?? 0,
      clockTampered: snap.clockTampered ?? false,
      optionsShuffled: shuffled,
      optionOrder: restoredOrder,
      lockBlocked: false,
      timeRemaining: remaining,
      resumeAvailable: null,
    });
    scheduleProgressSave(get);
    return true;
  },

  discardResume: () => {
    clearProgress();
    set({ resumeAvailable: null });
  },

  navigateTo: (idx) => {
    const { questions, isSectionalMode, meta, currentSectionIdx, phase } = get();
    if (idx < 0 || idx >= questions.length) return;
    // In sectional mode (pre-submit), clamp to active section.
    if (phase === 'active' && isSectionalMode && meta) {
      const sec = meta.sections[currentSectionIdx];
      if (idx < sec.start || idx > sec.end) return;
    }
    flushTime(get, set);
    _qEnterTs = Date.now();
    set((s) => ({ currentIdx: idx, visited: new Set(s.visited).add(idx) }));
    scheduleProgressSave(get);
  },

  setCurrentSection: (secIdx) => {
    const { meta, phase, isSectionalMode } = get();
    if (!meta) return;
    if (secIdx < 0 || secIdx >= meta.sections.length) return;
    // In the active phase of a sectional exam, jump to the section's first
    // question and make it the active section (palette/controls/nav clamp follow).
    // Post-submit (review) sections are informational only — nothing is clamped then.
    if (phase === 'active' && isSectionalMode) {
      const sec = meta.sections[secIdx];
      flushTime(get, set);
      _qEnterTs = Date.now();
      set((s) => ({
        currentSectionIdx: secIdx,
        currentIdx: sec.start,
        visited: new Set(s.visited).add(sec.start),
      }));
      scheduleProgressSave(get);
    } else {
      set({ currentSectionIdx: secIdx });
    }
  },

  next: () => {
    const { currentIdx, questions, isSectionalMode, meta, currentSectionIdx, phase } = get();
    let max = questions.length - 1;
    if (phase === 'active' && isSectionalMode && meta) max = meta.sections[currentSectionIdx].end;
    if (currentIdx < max) get().navigateTo(currentIdx + 1);
  },

  prev: () => {
    const { currentIdx, isSectionalMode, meta, currentSectionIdx, phase } = get();
    let min = 0;
    if (phase === 'active' && isSectionalMode && meta) min = meta.sections[currentSectionIdx].start;
    if (currentIdx > min) get().navigateTo(currentIdx - 1);
  },

  selectOption: (qIdx, optIdx) => {
    const { phase, reattemptMode, revealedSolutions, isSectionalMode, meta, currentSectionIdx } = get();
    // Post-submit: only allow changes in reattempt mode before revealing.
    if (phase === 'submitted') {
      if (!reattemptMode || revealedSolutions.has(qIdx)) return;
      set((s) => ({ answers: { ...s.answers, [qIdx]: optIdx } }));
      return;
    }
    if (phase !== 'active') return;
    if (isSectionalMode && meta) {
      const sec = meta.sections[currentSectionIdx];
      if (qIdx < sec.start || qIdx > sec.end) return;
    }
    set((s) => ({ answers: { ...s.answers, [qIdx]: optIdx } }));
    scheduleProgressSave(get);
  },

  clearSelection: (qIdx) => {
    if (get().phase !== 'active') return;
    set((s) => {
      const a = { ...s.answers };
      delete a[qIdx];
      return { answers: a };
    });
    scheduleProgressSave(get);
  },

  toggleFlag: (qIdx) => {
    if (get().phase !== 'active') return;
    set((s) => {
      const f = new Set(s.flags);
      if (f.has(qIdx)) f.delete(qIdx);
      else f.add(qIdx);
      return { flags: f };
    });
    scheduleProgressSave(get);
  },

  saveNext: () => {
    // Save is implicit (selectOption already persists). Just advance.
    get().next();
  },

  markAndNext: () => {
    const { currentIdx, flags, phase } = get();
    if (phase !== 'active') return;
    if (!flags.has(currentIdx)) {
      set((s) => ({ flags: new Set(s.flags).add(currentIdx) }));
    }
    get().next();
    // next() saves on advance; on the last question it no-ops, so persist the
    // flag here or it would be missing from a crash-recovery snapshot.
    scheduleProgressSave(get);
  },

  clearAndStay: () => {
    const { currentIdx } = get();
    get().clearSelection(currentIdx);
  },

  recordFsExit: () => {
    set((s) => ({ fsExits: Math.min(MAX_FS_EXITS, s.fsExits + 1) }));
    scheduleProgressSave(get);
  },

  recordTabSwitch: () => {
    set((s) => ({ tabSwitches: Math.min(MAX_TAB_SWITCHES, s.tabSwitches + 1) }));
    scheduleProgressSave(get);
  },

  setOptionsShuffled: (v) => set({ optionsShuffled: v }),

  tick: () => {
    const { phase, timeRemaining, meta } = get();
    if (phase !== 'active') return;
    // Clock-tamper detection: the monotonic clock can't be rewound by system
    // settings, so a wall-clock jump without a matching monotonic jump means
    // someone moved the system clock (e.g. to extend the deadline).
    const now = Date.now();
    const mono = typeof performance !== 'undefined' ? performance.now() : now;
    if (_lastTickWall !== null && _lastTickMono !== null) {
      const drift = Math.abs(now - _lastTickWall - (mono - _lastTickMono));
      if (drift > CLOCK_TAMPER_MS && !get().clockTampered) {
        set({ clockTampered: true });
        scheduleProgressSave(get);
      }
    }
    _lastTickWall = now;
    _lastTickMono = mono;
    // Derive remaining time from the wall-clock deadline so a throttled or
    // paused interval (background tab / sleep) can't extend the exam.
    let remaining: number;
    if (_endsAt !== null) {
      const wallRemaining = Math.max(0, Math.ceil((_endsAt - Date.now()) / 1000));
      // Guard against system-clock jumps (NTP correction / timezone change).
      // A single tick cannot legitimately drop more than the exam duration;
      // anything larger means the wall clock jumped and we fall back to a
      // safe per-tick decrement to avoid a false auto-submit.
      const totalDuration = meta?.durationMinutes
        ? meta.durationMinutes * 60
        : 3600;
      if (wallRemaining <= timeRemaining - totalDuration) {
        remaining = timeRemaining - 1;
      } else {
        remaining = wallRemaining;
      }
    } else {
      remaining = timeRemaining - 1; // fallback for safety if startExam never ran
    }
    if (remaining <= 0) {
      set({ timeRemaining: 0 });
      get().submit();
      return;
    }
    // Fire a native notification once per time-warning threshold.
    for (const t of TIME_WARN_SECS) {
      if (remaining <= t && !_warnedThresholds.has(t)) {
        _warnedThresholds.add(t);
        const mins = Math.floor(t / 60);
        const label = mins >= 1 ? `${mins} minute${mins > 1 ? 's' : ''} remaining` : `${t} seconds remaining`;
        try { (window as any).aetherDesktop?.notify?.('Time Warning', label); } catch { /* non-Electron */ }
        break; // only fire one per tick
      }
    }
    if (remaining !== timeRemaining) set({ timeRemaining: remaining });
  },

  setLang: (lang) => set({ lang }),
  toggleReattempt: () => set((s) => ({ reattemptMode: !s.reattemptMode })),
  revealSolution: (qIdx) =>
    set((s) => ({ revealedSolutions: new Set(s.revealedSolutions).add(qIdx) })),

  submit: () => {
    const { questions, answers, meta, flags, fsExits, tabSwitches, clockTampered, optionsShuffled } = get();
    if (get().phase === 'submitted') return;
    // Guard before any side effects: an ignored submit must leave the
    // resume snapshot, exam lock, and heartbeat untouched.
    if (!questions.length) {
      console.warn('[exam] submit ignored: no questions loaded');
      return;
    }
    // The attempt is over — a resume snapshot must not outlive it.
    cancelScheduledProgressSave();
    clearProgress();
    desktopExamEnd();
    stopLockHeartbeat();
    releaseExamLock();
    flushTime(get, set);
    const finalTimes = get().questionTimes;
    const result = scoreAttempt(questions, get().answers, meta?.sections);

    // Build per-question snapshot — exactly what review + analytics need.
    const perQuestion: PerQuestionRecord[] = questions.map((q, idx) => {
      const chosen = answers[idx];
      const correctOpt = q.correct_option_id;
      return {
        idx,
        chosen,
        correctOption: correctOpt,
        isCorrect: chosen !== undefined && chosen === correctOpt,
        isIncorrect: chosen !== undefined && chosen !== correctOpt,
        isSkipped: chosen === undefined,
        flagged: flags.has(idx),
        timeSec: finalTimes[idx] || 0,
      };
    });

    // Freeze what the user actually submitted. Re-attempt mode continues to
    // mutate `answers` as a working copy; review UI reads submittedAnswers.
    set({ phase: 'submitted', result, answers, submittedAnswers: { ...answers }, persistFailed: false });

    // Persist to the shared aether-db (compatible with the legacy site).
    if (meta) {
      try {
        saveAttempt(meta.path, {
          score: result.score,
          maxScore: result.maxScore,
          correct: result.correct,
          incorrect: result.incorrect,
          unattempted: result.unattempted,
          accuracy: result.accuracy,
          sections: meta.sections.map((s) => ({ name: s.name, start: s.start, end: s.end })),
          questionTimes: { ...finalTimes },
          fsExits,
          tabSwitches,
          clockTampered,
          optionsShuffled,
          perQuestion,
          provider: meta.provider,
        });
        // Roll up subject stats.
        if (meta.subject) recordSubjectAttempt(meta.subject, result.accuracy);
        // Fold outcome back into any saved questions of this exam.
        attachAttemptToSaved(meta.path, perQuestion.map(({ idx, chosen, isCorrect, isIncorrect, isSkipped, flagged }) => ({
          idx, chosen, isCorrect, isIncorrect, isSkipped, flagged,
        })));
      } catch (e) {
        console.warn('[exam] persist failed', e);
        set({ persistFailed: true });
      }
      // saveAttempt swallows internal quota errors (the session stays usable),
      // so also check the storage health flag the attempt store maintains.
      if (!storageHealthy()) {
        set({ persistFailed: true });
      }
    }
  },

  flushProgress: () => {
    cancelScheduledProgressSave();
    flushTime(get, set);
    persistProgressNow(get);
  },

  reset: () => {
    cancelScheduledProgressSave();
    desktopExamEnd();
    stopLockHeartbeat();
    releaseExamLock();
    _lastTickWall = null;
    _lastTickMono = null;
    // Do NOT clear the progress snapshot here — submit() already clears it
    // on exam completion, and clearing on unmount breaks the resume feature
    // (any clean navigation away from the exam would wipe the snapshot).
    set({
      meta: null,
      questions: [],
      phase: 'welcome',
      currentIdx: 0,
      answers: {},
      flags: new Set(),
      visited: new Set([0]),
      timeRemaining: 0,
      questionTimes: {},
      isSectionalMode: false,
      currentSectionIdx: 0,
      reattemptMode: false,
      revealedSolutions: new Set(),
      fsExits: 0,
      tabSwitches: 0,
      clockTampered: false,
      optionsShuffled: true,
      optionOrder: {},
      lockBlocked: false,
      result: null,
      submittedAnswers: null,
      resumeAvailable: null,
      persistFailed: false,
    });
  },
}));

function flushTime(
  get: () => ExamState,
  set: (fn: (s: ExamState) => Partial<ExamState>) => void,
) {
  if (_qEnterTs !== null) {
    const idx = get().currentIdx;
    // Cap a single flush: a suspended background tab would otherwise dump
    // hours into whichever question happened to be open.
    const elapsed = Math.min(MAX_FLUSH_SECS, Math.round((Date.now() - _qEnterTs) / 1000));
    set((s) => ({
      questionTimes: {
        ...s.questionTimes,
        [idx]: (s.questionTimes[idx] || 0) + Math.max(0, elapsed),
      },
    }));
  }
}

/* Progress snapshot persistence */

function persistProgressNow(get: () => ExamState): void {
  const s = get();
  if (s.phase !== 'active' || !s.meta || _endsAt === null) return;
  saveProgress({
    version: 1,
    path: s.meta.path,
    savedAt: new Date().toISOString(),
    answers: s.answers,
    flags: [...s.flags],
    visited: [...s.visited],
    currentIdx: s.currentIdx,
    currentSectionIdx: s.currentSectionIdx,
    endsAt: _endsAt,
    questionTimes: s.questionTimes,
    fsExits: s.fsExits,
    tabSwitches: s.tabSwitches,
    clockTampered: s.clockTampered,
    optionsShuffled: s.optionsShuffled,
    // The permutation is only meaningful (and only saved) when shuffling —
    // keeps the snapshot small for the default canonical layout.
    ...(s.optionsShuffled ? { optionOrder: s.optionOrder } : {}),
  });
}

function scheduleProgressSave(get: () => ExamState): void {
  if (get().phase !== 'active') return;
  if (_progressTimer) clearTimeout(_progressTimer);
  _progressTimer = setTimeout(() => persistProgressNow(get), PROGRESS_SAVE_DEBOUNCE_MS);
}

function cancelScheduledProgressSave(): void {
  if (_progressTimer) {
    clearTimeout(_progressTimer);
    _progressTimer = null;
  }
}
