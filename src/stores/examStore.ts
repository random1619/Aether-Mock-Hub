/* EXAM STORE — the exam engine state machine (Zustand).
   Owns: questions, answers, flags, visited, timer, sections,
   navigation, review mode, scoring. Pure logic lives in lib/scoring. */
import { create } from 'zustand';
import type { ExamMeta, ExamPhase, Question, PerQuestionRecord, LangView, ExamPattern, Attempt } from '@/types';
import { scoreAttempt, type ScoreResult } from '@/lib/scoring';
import { saveAttempt, attachAttemptToSaved, recordSubjectAttempt, storageHealthy, getLatestAttempt, getAllAttempts, canonicalizePath } from '@/services/attemptStore';
import { persistAttemptToBackend } from '@/services/backendApi';
import {
  saveProgress,
  loadProgress,
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
import {
  detectAndConfigurePattern,
  canAccessSection,
  getSectionGroupIndices,
  getGroupBounds,
} from '@/services/cglPattern';

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

  /** Seconds remaining (whole exam). */
  timeRemaining: number;
  /** Seconds spent per question. */
  questionTimes: Record<number, number>;

  isSectionalMode: boolean;
  currentSectionIdx: number;

  /** CGL & Sectional timing and lock states */
  pattern: ExamPattern;
  patternDescription: string;
  sectionalTimerEnabled: boolean;
  /** Seconds remaining in the current active section */
  sectionTimeRemaining: number;
  /** Set of section indices that are locked during active phase */
  lockedSections: Set<number>;
  /** Set of section indices that have been submitted/completed */
  completedSections: Set<number>;

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

  /** Historical attempts for this mock */
  latestAttempt: Attempt | null;
  allAttempts: Attempt[];
  /** Currently active attempt being inspected in review mode */
  activeAttempt: Attempt | null;

  /* ── actions ── */
  loadExam: (meta: ExamMeta, questions: Question[]) => void;
  /** Load and inspect previously submitted responses into full review mode */
  reviewAttempt: (targetAttempt?: Attempt | number, keepCurrentIdx?: boolean) => void;
  /** Switch which attempt's responses are being viewed in review mode without losing question cursor */
  switchReviewAttempt: (attemptNumber: number) => void;
  /** Re-take the mock test from the beginning */
  reattemptMock: () => void;
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
  /** Submit current section and advance to next section, or submit exam if final section. */
  submitCurrentSection: () => void;
  setSectionalTimerEnabled: (enabled: boolean) => void;
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
  tick: () => void;
  setLang: (lang: LangView) => void;
  toggleReattempt: () => void;
  revealSolution: (qIdx: number) => void;
  submit: () => void;
  flushProgress: () => void;
  reset: () => void;
}

let _qEnterTs: number | null = null;
/** Wall-clock deadline (ms epoch) for the whole active exam. */
let _endsAt: number | null = null;
/** Wall-clock deadline (ms epoch) for the current active section. */
let _sectionEndsAt: number | null = null;
let _progressTimer: ReturnType<typeof setTimeout> | null = null;
/** Last tick's wall + monotonic readings, for clock-tamper detection. */
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
  pattern: 'standard',
  patternDescription: '',
  sectionalTimerEnabled: false,
  sectionTimeRemaining: 0,
  lockedSections: new Set(),
  completedSections: new Set(),
  reattemptMode: false,
  revealedSolutions: new Set(),
  // Default to 'both': most mocks are code-mixed, so a single-script view would
  // delete legitimate words. 'both' renders the source verbatim (lossless).
  lang: 'both',
  fsExits: 0,
  tabSwitches: 0,
  clockTampered: false,
  lockBlocked: false,
  result: null,
  submittedAnswers: null,
  resumeAvailable: null,
  persistFailed: false,
  latestAttempt: null,
  allAttempts: [],
  activeAttempt: null,

  loadExam: (meta, questions) => {
    const patternConfig = detectAndConfigurePattern(meta, questions);
    const enrichedMeta: ExamMeta = {
      ...meta,
      sections: patternConfig.sections,
      durationMinutes: patternConfig.totalDurationMinutes,
      pattern: patternConfig.pattern,
      hasSectionalTimer: patternConfig.hasSectionalTimer,
    };
    const isSectional = enrichedMeta.sections.length > 1;
    _endsAt = null;
    _sectionEndsAt = null;
    _lastTickWall = null;
    _lastTickMono = null;
    cancelScheduledProgressSave();
    desktopExamEnd(); // belt-and-braces if a previous exam wasn't reset cleanly
    stopLockHeartbeat();
    releaseExamLock();

    // If an expired in-progress attempt exists with answers, auto-submit and save it
    // so the candidate's marked responses are never discarded!
    const rawSnap = loadProgress();
    if (rawSnap && canonicalizePath(rawSnap.path) === canonicalizePath(meta.path) && rawSnap.endsAt <= Date.now()) {
      const answeredCount = Object.keys(rawSnap.answers || {}).length;
      if (answeredCount > 0) {
        try {
          const scored = scoreAttempt(questions, rawSnap.answers, enrichedMeta.sections);
          const perQuestion: PerQuestionRecord[] = questions.map((q, idx) => {
            const chosen = rawSnap.answers[idx];
            const correctOpt = q.correct_option_id;
            return {
              idx,
              chosen,
              correctOption: correctOpt,
              isCorrect: chosen !== undefined && chosen === correctOpt,
              isIncorrect: chosen !== undefined && chosen !== correctOpt,
              isSkipped: chosen === undefined,
              flagged: (rawSnap.flags || []).includes(idx),
              timeSec: rawSnap.questionTimes?.[idx] || 0,
            };
          });
          saveAttempt(meta.path, {
            score: scored.score,
            maxScore: scored.maxScore,
            correct: scored.correct,
            incorrect: scored.incorrect,
            unattempted: scored.unattempted,
            accuracy: scored.accuracy,
            sections: enrichedMeta.sections.map((s) => ({ name: s.name, start: s.start, end: s.end })),
            questionTimes: rawSnap.questionTimes || {},
            fsExits: rawSnap.fsExits || 0,
            tabSwitches: rawSnap.tabSwitches || 0,
            clockTampered: rawSnap.clockTampered || false,
            perQuestion,
            provider: meta.provider,
          });
        } catch (err) {
          console.warn('[exam] failed to auto-submit expired snapshot', err);
        }
      }
      clearProgress();
    }

    const latestAttempt = getLatestAttempt(meta.path);
    const allAttempts = getAllAttempts(meta.path);
    const initialSecDuration = (enrichedMeta.sections[0]?.durationMinutes || 15) * 60;

    set({
      meta: enrichedMeta,
      questions,
      phase: 'welcome',
      currentIdx: 0,
      answers: {},
      flags: new Set(),
      visited: new Set([0]),
      timeRemaining: enrichedMeta.durationMinutes * 60,
      questionTimes: {},
      isSectionalMode: isSectional,
      currentSectionIdx: 0,
      pattern: patternConfig.pattern,
      patternDescription: patternConfig.description,
      sectionalTimerEnabled: patternConfig.hasSectionalTimer,
      sectionTimeRemaining: initialSecDuration,
      lockedSections: new Set(),
      completedSections: new Set(),
      reattemptMode: false,
      revealedSolutions: new Set(),
      fsExits: 0,
      tabSwitches: 0,
      clockTampered: false,
      lockBlocked: false,
      result: null,
      submittedAnswers: null,
      persistFailed: false,
      lang: /(^|\/)providers\/Mocks360\//i.test(meta.path) ? 'en' : 'both',
      resumeAvailable: loadProgressFor(meta.path),
      latestAttempt,
      allAttempts,
    });
    if (!get().resumeAvailable) {
      loadProgressFromDisk(meta.path).then((snap) => {
        if (snap && get().phase === 'welcome' && get().meta?.path === meta.path) {
          set({ resumeAvailable: snap });
        }
      });
    }
  },

  reviewAttempt: (targetAttempt, keepCurrentIdx = false) => {
    const { meta, questions, allAttempts, currentIdx: existingIdx } = get();
    if (!meta || !questions.length) return;

    let attempt: Attempt | null = null;
    if (typeof targetAttempt === 'number') {
      attempt = allAttempts.find((a) => a.attemptNumber === targetAttempt) || null;
    } else if (targetAttempt && typeof targetAttempt === 'object') {
      attempt = targetAttempt;
    } else {
      attempt = get().latestAttempt || (allAttempts.length > 0 ? allAttempts[allAttempts.length - 1] : null) || getLatestAttempt(meta.path);
    }
    if (!attempt) return;

    const answers: Record<number, number> = {};
    const flags = new Set<number>();
    const questionTimes: Record<number, number> = { ...(attempt.questionTimes || {}) };

    // Restore user responses from perQuestion data
    if (attempt.perQuestion && attempt.perQuestion.length > 0) {
      attempt.perQuestion.forEach((pq) => {
        // Restore chosen answer if it exists (including 0 as a valid option index)
        if (typeof pq.chosen === 'number' && pq.chosen >= 0) {
          answers[pq.idx] = pq.chosen;
        }
        // Restore flagged status
        if (pq.flagged) {
          flags.add(pq.idx);
        }
        // Restore time spent on question
        if (typeof pq.timeSec === 'number' && pq.timeSec > 0) {
          questionTimes[pq.idx] = pq.timeSec;
        }
      });
    }

    const scored = scoreAttempt(questions, answers, meta.sections);
    const result: ScoreResult = {
      ...scored,
      score: attempt.score,
      maxScore: attempt.maxScore,
      correct: attempt.correct,
      incorrect: attempt.incorrect,
      unattempted: attempt.unattempted,
      accuracy: attempt.accuracy,
    };

    cancelScheduledProgressSave();
    desktopExamEnd();
    stopLockHeartbeat();
    releaseExamLock();
    _sectionEndsAt = null;

    set({
      phase: 'submitted',
      answers,
      submittedAnswers: { ...answers },
      flags,
      visited: new Set(questions.map((_, i) => i)),
      questionTimes,
      result,
      activeAttempt: attempt,
      fsExits: attempt.fsExits || 0,
      tabSwitches: attempt.tabSwitches || 0,
      clockTampered: attempt.clockTampered || false,
      reattemptMode: false,
      revealedSolutions: new Set(),
      persistFailed: false,
      currentIdx: keepCurrentIdx ? Math.min(existingIdx, questions.length - 1) : 0,
      currentSectionIdx: 0,
    });
  },

  switchReviewAttempt: (attemptNumber) => {
    get().reviewAttempt(attemptNumber, true);
  },

  reattemptMock: () => {
    const { meta, questions } = get();
    if (!meta || !questions.length) return;
    get().loadExam(meta, questions);
  },

  setSectionalTimerEnabled: (enabled) => {
    const { phase, meta, currentSectionIdx, sectionTimeRemaining } = get();
    if (enabled && phase === 'active' && meta && !_sectionEndsAt) {
      // Re-arm current group's timer when turning on mid-exam
      const remaining = sectionTimeRemaining > 0 ? sectionTimeRemaining : (meta.sections[currentSectionIdx]?.durationMinutes || 15) * 60;
      _sectionEndsAt = Date.now() + remaining * 1000;
      set({ sectionalTimerEnabled: enabled, sectionTimeRemaining: remaining });
      scheduleProgressSave(get);
    } else if (!enabled) {
      _sectionEndsAt = null;
      set({ sectionalTimerEnabled: enabled });
      scheduleProgressSave(get);
    } else {
      set({ sectionalTimerEnabled: enabled });
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

    if (get().sectionalTimerEnabled && meta && meta.sections.length > 0) {
      const secDur = (meta.sections[0]?.durationMinutes || 15) * 60;
      _sectionEndsAt = Date.now() + secDur * 1000;
      set({ sectionTimeRemaining: secDur });
    } else {
      _sectionEndsAt = null;
    }

    _warnedThresholds = new Set();
    _lastTickWall = null;
    _lastTickMono = null;
    desktopExamStart();
    startLockHeartbeat();
    set({
      phase: 'active',
      resumeAvailable: null,
      lockBlocked: false,
      lockedSections: new Set(),
      completedSections: new Set(),
    });
    // Persist right away so a fast crash/resume keeps the state intact.
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

    const secTimerEnabled = snap.sectionalTimerEnabled ?? get().sectionalTimerEnabled;
    let secRemaining = 0;
    if (secTimerEnabled && snap.sectionEndsAt) {
      _sectionEndsAt = snap.sectionEndsAt;
      secRemaining = Math.max(0, Math.ceil((_sectionEndsAt - Date.now()) / 1000));
    } else if (secTimerEnabled && get().meta) {
      const secIdx = snap.currentSectionIdx || 0;
      const secDur = (get().meta?.sections[secIdx]?.durationMinutes || 15) * 60;
      _sectionEndsAt = Date.now() + secDur * 1000;
      secRemaining = secDur;
    } else {
      _sectionEndsAt = null;
    }

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
    set({
      phase: 'active',
      answers: cleanAnswers,
      flags: new Set(snap.flags),
      visited: new Set(snap.visited),
      currentIdx: Math.min(snap.currentIdx, get().questions.length - 1),
      currentSectionIdx: snap.currentSectionIdx,
      sectionalTimerEnabled: secTimerEnabled,
      sectionTimeRemaining: secRemaining,
      lockedSections: new Set(snap.lockedSections || []),
      completedSections: new Set(snap.completedSections || []),
      questionTimes: cleanTimes,
      fsExits: snap.fsExits,
      tabSwitches: snap.tabSwitches ?? 0,
      clockTampered: snap.clockTampered ?? false,
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
    const { questions, isSectionalMode, sectionalTimerEnabled, meta, currentSectionIdx, lockedSections, phase } = get();
    if (idx < 0 || idx >= questions.length) return;

    // Post-submit: ALL UNLOCKED!
    if (phase === 'submitted') {
      flushTime(get, set);
      _qEnterTs = Date.now();
      let targetSecIdx = currentSectionIdx;
      if (meta) {
        const found = meta.sections.findIndex((s) => idx >= s.start && idx <= s.end);
        if (found >= 0) targetSecIdx = found;
      }
      set((s) => ({ currentIdx: idx, currentSectionIdx: targetSecIdx, visited: new Set(s.visited).add(idx) }));
      return;
    }

    // In active phase: check if target question is in an accessible section
    if (phase === 'active' && meta) {
      const targetSecIdx = meta.sections.findIndex((s) => idx >= s.start && idx <= s.end);
      if (targetSecIdx >= 0) {
        const accessible = canAccessSection(
          targetSecIdx,
          currentSectionIdx,
          lockedSections,
          sectionalTimerEnabled,
          false,
          meta.sections,
        );
        if (!accessible) return; // Blocked by section lock!
      } else if (isSectionalMode) {
        const sec = meta.sections[currentSectionIdx];
        if (idx < sec.start || idx > sec.end) return;
      }
    }

    flushTime(get, set);
    _qEnterTs = Date.now();
    set((s) => ({ currentIdx: idx, visited: new Set(s.visited).add(idx) }));
    scheduleProgressSave(get);
  },

  setCurrentSection: (secIdx) => {
    const { meta, phase, sectionalTimerEnabled, currentSectionIdx, lockedSections } = get();
    if (!meta) return;
    if (secIdx < 0 || secIdx >= meta.sections.length) return;

    // Post-submit: ALL UNLOCKED!
    if (phase === 'submitted') {
      const sec = meta.sections[secIdx];
      flushTime(get, set);
      _qEnterTs = Date.now();
      set((s) => ({
        currentSectionIdx: secIdx,
        currentIdx: sec.start,
        visited: new Set(s.visited).add(sec.start),
      }));
      return;
    }

    // In active phase: check access permissions
    if (phase === 'active') {
      const accessible = canAccessSection(
        secIdx,
        currentSectionIdx,
        lockedSections,
        sectionalTimerEnabled,
        false,
        meta.sections,
      );
      if (!accessible) return; // Blocked by section lock!

      const sec = meta.sections[secIdx];
      flushTime(get, set);
      _qEnterTs = Date.now();
      set((s) => ({
        currentSectionIdx: secIdx,
        currentIdx: sec.start,
        visited: new Set(s.visited).add(sec.start),
      }));
      scheduleProgressSave(get);
    }
  },

  submitCurrentSection: () => {
    const { meta, currentSectionIdx, lockedSections, completedSections, sectionalTimerEnabled, phase } = get();
    if (phase !== 'active' || !meta) return;

    flushTime(get, set);
    _qEnterTs = Date.now();

    // Lock all modules in the current group
    const currentGroupIndices = getSectionGroupIndices(currentSectionIdx, meta.sections);
    const newLocked = new Set(lockedSections);
    const newCompleted = new Set(completedSections);
    for (const idx of currentGroupIndices) {
      newLocked.add(idx);
      newCompleted.add(idx);
    }

    // Find the next uncompleted section
    let nextSecIdx: number | null = null;
    for (let i = 0; i < meta.sections.length; i++) {
      if (!newLocked.has(i)) {
        nextSecIdx = i;
        break;
      }
    }

    if (nextSecIdx === null) {
      // No more sections — submit the whole exam
      set({ lockedSections: newLocked, completedSections: newCompleted });
      get().submit();
      return;
    }

    // Advance to next section and arm its timer
    const nextSec = meta.sections[nextSecIdx];
    const nextDuration = (nextSec.durationMinutes || 15) * 60;
    _sectionEndsAt = sectionalTimerEnabled ? Date.now() + nextDuration * 1000 : null;

    set((s) => ({
      currentSectionIdx: nextSecIdx!,
      currentIdx: nextSec.start,
      visited: new Set(s.visited).add(nextSec.start),
      lockedSections: newLocked,
      completedSections: newCompleted,
      sectionTimeRemaining: nextDuration,
    }));

    scheduleProgressSave(get);
  },

  next: () => {
    const { currentIdx, questions, isSectionalMode, meta, currentSectionIdx, phase, sectionalTimerEnabled } = get();
    let max = questions.length - 1;
    if (phase === 'active' && isSectionalMode && meta) {
      // When sectional timer is on and Tier 2 groups exist, allow free movement
      // within the whole group (e.g. Math ↔ Reasoning share 60m)
      if (sectionalTimerEnabled && meta.sections[currentSectionIdx]?.groupId) {
        max = getGroupBounds(currentSectionIdx, meta.sections).end;
      } else {
        max = meta.sections[currentSectionIdx].end;
      }
    }
    if (currentIdx < max) get().navigateTo(currentIdx + 1);
  },

  prev: () => {
    const { currentIdx, isSectionalMode, meta, currentSectionIdx, phase, sectionalTimerEnabled } = get();
    let min = 0;
    if (phase === 'active' && isSectionalMode && meta) {
      if (sectionalTimerEnabled && meta.sections[currentSectionIdx]?.groupId) {
        min = getGroupBounds(currentSectionIdx, meta.sections).start;
      } else {
        min = meta.sections[currentSectionIdx].start;
      }
    }
    if (currentIdx > min) get().navigateTo(currentIdx - 1);
  },

  selectOption: (qIdx, optIdx) => {
    const { phase, reattemptMode, revealedSolutions, sectionalTimerEnabled, meta, currentSectionIdx, lockedSections } = get();
    // Post-submit: only allow changes in reattempt mode before revealing.
    if (phase === 'submitted') {
      if (!reattemptMode || revealedSolutions.has(qIdx)) return;
      set((s) => ({ answers: { ...s.answers, [qIdx]: optIdx } }));
      return;
    }
    if (phase !== 'active') return;
    if (meta) {
      const targetSecIdx = meta.sections.findIndex((s) => qIdx >= s.start && qIdx <= s.end);
      if (targetSecIdx >= 0) {
        const accessible = canAccessSection(
          targetSecIdx,
          currentSectionIdx,
          lockedSections,
          sectionalTimerEnabled,
          false,
          meta.sections,
        );
        if (!accessible) return;
      }
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
    get().next();
  },

  markAndNext: () => {
    const { currentIdx, flags, phase } = get();
    if (phase !== 'active') return;
    if (!flags.has(currentIdx)) {
      set((s) => ({ flags: new Set(s.flags).add(currentIdx) }));
    }
    get().next();
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

  tick: () => {
    const { phase, timeRemaining, meta, sectionalTimerEnabled, sectionTimeRemaining } = get();
    if (phase !== 'active') return;
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

    // ── Handle Sectional Timer ──
    if (sectionalTimerEnabled && _sectionEndsAt !== null) {
      const wallSecRemaining = Math.max(0, Math.ceil((_sectionEndsAt - now) / 1000));
      if (wallSecRemaining <= 0) {
        // Section timer expired — auto-advance to next section
        try {
          (window as any).aetherDesktop?.notify?.('Section Time Over', 'Time for this section has ended. Moving to the next section.');
        } catch { /* non-Electron */ }
        get().submitCurrentSection();
        return;
      }
      if (wallSecRemaining !== sectionTimeRemaining) {
        set({ sectionTimeRemaining: wallSecRemaining });
      }
    }

    // ── Handle Overall Timer ──
    let remaining: number;
    if (_endsAt !== null) {
      const wallRemaining = Math.max(0, Math.ceil((_endsAt - now) / 1000));
      const totalDuration = meta?.durationMinutes
        ? meta.durationMinutes * 60
        : 3600;
      if (wallRemaining <= timeRemaining - totalDuration) {
        remaining = timeRemaining - 1;
      } else {
        remaining = wallRemaining;
      }
    } else {
      remaining = timeRemaining - 1;
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
        break;
      }
    }
    if (remaining !== timeRemaining) set({ timeRemaining: remaining });
  },

  setLang: (lang) => set({ lang }),
  toggleReattempt: () => set((s) => ({ reattemptMode: !s.reattemptMode })),
  revealSolution: (qIdx) =>
    set((s) => ({ revealedSolutions: new Set(s.revealedSolutions).add(qIdx) })),

  submit: () => {
    const { questions, answers, meta, flags, fsExits, tabSwitches, clockTampered } = get();
    if (get().phase === 'submitted') return;
    if (!questions.length) {
      console.warn('[exam] submit ignored: no questions loaded');
      return;
    }
    cancelScheduledProgressSave();
    clearProgress();
    desktopExamEnd();
    stopLockHeartbeat();
    releaseExamLock();
    _sectionEndsAt = null;
    flushTime(get, set);
    const finalTimes = get().questionTimes;
    const result = scoreAttempt(questions, get().answers, meta?.sections);

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

    // Unlocks all sections upon submission.
    set({
      phase: 'submitted',
      result,
      answers,
      submittedAnswers: { ...answers },
      persistFailed: false,
      sectionTimeRemaining: 0,
    });

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
          perQuestion,
          provider: meta.provider,
        });
        if (meta.subject) recordSubjectAttempt(meta.subject, result.accuracy);
        attachAttemptToSaved(meta.path, perQuestion.map(({ idx, chosen, isCorrect, isIncorrect, isSkipped, flagged }) => ({
          idx, chosen, isCorrect, isIncorrect, isSkipped, flagged,
        })));
        const updatedLatest = getLatestAttempt(meta.path);
        const updatedAll = getAllAttempts(meta.path);
        if (updatedLatest) {
          persistAttemptToBackend(meta.path, updatedLatest);
        }
        set({
          latestAttempt: updatedLatest,
          allAttempts: updatedAll,
          activeAttempt: updatedLatest,
        });
      } catch (e) {
        console.warn('[exam] persist failed', e);
        set({ persistFailed: true });
      }
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
    _sectionEndsAt = null;
    _lastTickWall = null;
    _lastTickMono = null;
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
      pattern: 'standard',
      patternDescription: '',
      sectionalTimerEnabled: false,
      sectionTimeRemaining: 0,
      lockedSections: new Set(),
      completedSections: new Set(),
      reattemptMode: false,
      revealedSolutions: new Set(),
      fsExits: 0,
      tabSwitches: 0,
      clockTampered: false,
      lockBlocked: false,
      result: null,
      submittedAnswers: null,
      resumeAvailable: null,
      persistFailed: false,
      latestAttempt: null,
      allAttempts: [],
      activeAttempt: null,
    });
  },
}));

function flushTime(
  get: () => ExamState,
  set: (fn: (s: ExamState) => Partial<ExamState>) => void,
) {
  if (_qEnterTs !== null) {
    const idx = get().currentIdx;
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
    sectionalTimerEnabled: s.sectionalTimerEnabled,
    sectionEndsAt: _sectionEndsAt ?? undefined,
    lockedSections: [...s.lockedSections],
    completedSections: [...s.completedSections],
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
